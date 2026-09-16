import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 * POST /api/ai-sales
 * Body: { telefone: string, instance?: string }
 *
 * 1. Busca últimas mensagens do atendimento
 * 2. Envia pro Gemini com script de vendas
 * 3. Retorna resposta + se deve criar tarefa no kanban
 */
export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY não configurada" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Webhook pode chamar sem auth (service_role), então aceita sem user
  const body = await request.json();
  const { telefone, instance } = body;

  if (!telefone) {
    return NextResponse.json({ error: "Telefone é obrigatório" }, { status: 400 });
  }

  // Limpa telefone
  const tel = telefone.replace(/\D/g, "");

  // Busca atendimento aberto
  let query = supabase
    .from("atendimentos")
    .select("id, nome_cliente, vendedor_id")
    .eq("telefone_cliente", tel)
    .eq("status", "aberto");

  if (instance) {
    query = query.eq("instance_name", instance);
  }

  const { data: atendimento } = await query.single();
  if (!atendimento) {
    return NextResponse.json({ error: "Atendimento não encontrado" }, { status: 404 });
  }

  // Busca últimas 20 mensagens
  const { data: mensagens } = await supabase
    .from("atendimento_mensagens")
    .select("remetente, conteudo, created_at")
    .eq("atendimento_id", atendimento.id)
    .order("created_at", { ascending: true })
    .limit(20);

  if (!mensagens || mensagens.length === 0) {
    return NextResponse.json({ resposta: null, criarTarefa: false });
  }

  // Monta histórico pro Gemini
  const historico = mensagens.map((m) => {
    const papel = m.remetente === "cliente" ? "Cliente" : "Vendedor";
    return `${papel}: ${m.conteudo}`;
  }).join("\n");

  const nomeCliente = atendimento.nome_cliente || "Cliente";

  // Chama Gemini
  const geminiPrompt = montarPrompt(nomeCliente, historico);

  try {
    const resposta = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: geminiPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      }),
    });

    const geminiData = await resposta.json();
    const textoResposta = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!textoResposta) {
      console.log("[AI Sales] Gemini não retornou resposta");
      return NextResponse.json({ resposta: null, criarTarefa: false });
    }

    // Pergunta ao Gemini se deve criar tarefa
    const deveCriarTarefa = await analisarOportunidade(nomeCliente, historico, textoResposta);

    return NextResponse.json({
      resposta: textoResposta,
      criarTarefa: deveCriarTarefa.criar,
      tarefa: deveCriarTarefa.criar ? {
        titulo: deveCriarTarefa.titulo || `Oportunidade: ${nomeCliente}`,
        descricao: deveCriarTarefa.descricao || "",
        prioridade: deveCriarTarefa.prioridade || "media",
        cliente_nome: nomeCliente,
      } : null,
    });

  } catch (err) {
    console.error("[AI Sales] Erro Gemini:", err);
    return NextResponse.json({ error: "Erro ao chamar Gemini" }, { status: 500 });
  }
}

/**
 * Monta o prompt com script de vendas para a Roma Distribuidora
 */
function montarPrompt(nomeCliente: string, historico: string): string {
  return `Você é um assistente de vendas da Roma Distribuidora de Materiais Elétricos.

SEU PAPEL:
- Responder mensagens de clientes no WhatsApp de forma simples e direta
- Fazer perguntas para qualificar o lead (descobrir o que precisa, quanto compra, frequência)
- Ser cordial mas não enrolar

SCRIPT DE VENDAS - SIGA ESTA ORDEM:
1. Primeira interação: "Olá! Somos a Roma Distribuidora de Materiais Elétricos. Como posso ajudar?"
2. Descobrir o que o cliente precisa: "Qual material elétrico você está procurando?"
3. Quantidade: "É para qual projeto? Precisa de quanto?"
4. Frequência: "Você compra com que frequência? É recorrente?"
5. Empresa/Loja: "Qual o nome da sua empresa/loja?"
6. Contato: "Pode me passar o nome e o melhor contato?"

REGRAS:
- Responda em NO MÁXIMO 2-3 frases curtas
- Não invente preços nem estoque
- Se o cliente pedir preço, diga que um vendedor vai entrar em contato
- Se o cliente não responde ou manda mensagem genérica ("oi", "bom dia"), seja breve
- Use linguagem simples e amigável
- NUNCA use emojis em excesso (máximo 1 por mensagem)
- Se o cliente já respondeu todas as perguntas, agradeça e diga que um vendedor entrará em contato

CONTEXTO DO CLIENTE: ${nomeCliente}

HISTÓRICO DA CONVERSA:
${historico}

Responda APENAS com a mensagem para o cliente (sem explicação, sem "Resposta:" no início).`;
}

/**
 * Analisa se a conversa indica uma oportunidade de venda
 */
async function analisarOportunidade(
  nomeCliente: string,
  historico: string,
  ultimaResposta: string
): Promise<{ criar: boolean; titulo?: string; descricao?: string; prioridade?: string }> {
  if (!GEMINI_API_KEY) return { criar: false };

  try {
    const prompt = `Analise esta conversa de vendas e diga se o cliente é uma OPORTUNIDADE DE VENDA.

Critérios para criar tarefa:
- Cliente demonstrou interesse concreto em comprar
- Cliente forneceu nome da empresa
- Cliente tem projeto em andamento que precisa de materiais
- Cliente é comprador recorrente

Responda APENAS com JSON (sem markdown):
{
  "criar": true/false,
  "titulo": "breve título da oportunidade (ex: 'Projeto elétrico - Empresa X')",
  "descricao": "resumo do que o cliente precisa",
  "prioridade": "alta/media/baixa"
}

CONVERSA:
${historico}

ÚLTIMA RESPOSTA DO ASSISTENTE:
${ultimaResposta}`;

    const resposta = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 200,
        },
      }),
    });

    const data = await resposta.json();
    const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Tenta parsear JSON (pode vir com ```json no início)
    const jsonMatch = texto.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { criar: false };

  } catch (err) {
    console.error("[AI Sales] Erro ao analisar oportunidade:", err);
    return { criar: false };
  }
}
