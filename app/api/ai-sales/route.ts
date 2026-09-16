import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { montarPromptVendas } from "@/lib/ai-sales-prompts/vendas";
import { analisarOportunidadeIA } from "@/lib/ai-sales-prompts/oportunidades";

export const dynamic = "force-dynamic";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 * POST /api/ai-sales
 * Body: { telefone: string, instance?: string }
 *
 * Endpoint standalone pra testes manuais.
 * Na prática, o webhook chama direto as funções auxiliares.
 */
export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY não configurada" }, { status: 500 });
  }

  const supabase = await createClient();
  const body = await request.json();
  const { telefone, instance } = body;

  if (!telefone) {
    return NextResponse.json({ error: "Telefone é obrigatório" }, { status: 400 });
  }

  const tel = telefone.replace(/\D/g, "");

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

  const { data: mensagens } = await supabase
    .from("atendimento_mensagens")
    .select("remetente, conteudo, created_at")
    .eq("atendimento_id", atendimento.id)
    .order("created_at", { ascending: true })
    .limit(20);

  if (!mensagens || mensagens.length === 0) {
    return NextResponse.json({ resposta: null, criarTarefa: false });
  }

  const historico = mensagens.map((m) => {
    const papel = m.remetente === "cliente" ? "Cliente" : "Vendedor";
    return `${papel}: ${m.conteudo}`;
  }).join("\n");

  const nomeCliente = atendimento.nome_cliente || "Cliente";
  const geminiPrompt = montarPromptVendas(nomeCliente, historico);

  try {
    const resposta = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: geminiPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
      }),
    });

    const geminiData = await resposta.json();
    const textoResposta = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!textoResposta) {
      return NextResponse.json({ resposta: null, criarTarefa: false });
    }

    const deveCriarTarefa = await analisarOportunidadeIA(GEMINI_API_KEY, nomeCliente, historico, textoResposta);

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
