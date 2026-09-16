/**
 * Prompt de análise de oportunidades da Roma Distribuidora
 * 
 * Avalia se a conversa indica um lead qualificado que merece tarefa no Kanban.
 * Ajuste os critérios aqui conforme as necessidades da equipe de vendas.
 */

interface Oportunidade {
  criar: boolean;
  titulo?: string;
  descricao?: string;
  prioridade?: string;
}

export async function analisarOportunidadeIA(
  apiKey: string,
  nomeCliente: string,
  historico: string,
  ultimaResposta: string
): Promise<Oportunidade> {
  const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  try {
    const prompt = `Analise esta conversa de vendas da Roma Distribuidora de Materiais Elétricos e diga se o cliente é uma OPORTUNIDADE DE VENDA.

CRITÉRIOS para criar tarefa (se QUALQUER um for atendido, crie):
- Cliente demonstrou interesse concreto em comprar um produto específico
- Cliente forneceu nome da empresa/loja
- Cliente tem projeto em andamento que precisa de materiais
- Cliente é comprador recorrente
- Cliente pediu preço ou disponibilidade de produto
- Cliente confirmou quantidade que precisa

NÃO crie tarefa se:
- Cliente só mandou "oi" ou cumprimento genérico
- Cliente está apenas fazendo uma pergunta vaga sem intenção de compra

Responda APENAS com JSON (sem markdown, sem \`\`\`):
{
  "criar": true/false,
  "titulo": "breve título (ex: 'Kit antena - Residencial', '50 disjuntores - Obra')",
  "descricao": "resumo do que o cliente precisa, quantidade, projeto",
  "prioridade": "alta (compra imediata) / media (interessado) / baixa (só cotando)"
}

CONVERSA:
${historico}

ÚLTIMA RESPOSTA DO ASSISTENTE:
${ultimaResposta}`;

    const resposta = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await resposta.json();
    const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

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
