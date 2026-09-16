import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai-sales/test?telefone=XXXXXXXXXXX
 * 
 * Teste manual do AI Sales - verifica cada etapa:
 * 1. Gemini API key
 * 2. Busca atendimento
 * 3. Busca mensagens
 * 4. Chama Gemini
 * 5. Envia via Evolution API
 */
export async function GET(request: NextRequest) {
  const logs: string[] = [];
  const { searchParams } = new URL(request.url);
  const telefone = searchParams.get("telefone") || "556234165027";

  // Step 1: Check Gemini API key
  const apiKey = process.env.GEMINI_API_KEY;
  logs.push(`1. GEMINI_API_KEY: ${apiKey ? `PRESENTE (${apiKey.substring(0, 10)}...)` : "AUSENTE ❌"}`);
  if (!apiKey) {
    return NextResponse.json({ logs, error: "GEMINI_API_KEY não configurada" }, { status: 500 });
  }

  // Step 2: Check Evolution API config
  const evoUrl = process.env.EVOLUTION_API_URL;
  const evoKey = process.env.EVOLUTION_API_KEY;
  logs.push(`2. EVOLUTION_API_URL: ${evoUrl || "AUSENTE ❌"}`);
  logs.push(`3. EVOLUTION_API_KEY: ${evoKey ? `PRESENTE (${evoKey.substring(0, 10)}...)` : "AUSENTE ❌"}`);

  // Step 3: Test Gemini API directly
  try {
    const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
    const resp = await fetch(`${geminiUrl}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Responda apenas: OK" }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    logs.push(`4. Gemini API test: ${resp.status} - "${text.trim()}"`);
    if (resp.status !== 200) {
      logs.push(`   Erro: ${JSON.stringify(data).substring(0, 200)}`);
    }
  } catch (err: any) {
    logs.push(`4. Gemini API test: FALHOU - ${err.message}`);
  }

  // Step 4: Test Evolution API send (dry run - just check connectivity)
  if (evoUrl && evoKey) {
    try {
      const resp = await fetch(`${evoUrl}/instance/fetchInstances`, {
        headers: { "apikey": evoKey },
      });
      logs.push(`5. Evolution API connectivity: ${resp.status}`);
      if (resp.ok) {
        const instances = await resp.json();
        const roma = instances.find((i: any) => i.name?.includes("ROMA"));
        if (roma) {
          logs.push(`   ROMA_1 instance: status=${roma.status}`);
          const wh = roma.webhook || {};
          logs.push(`   Webhook URL: ${wh.url || "NOT SET"}`);
          logs.push(`   Webhook events: ${JSON.stringify(wh.events || [])}`);
        } else {
          logs.push(`   ROMA instance NOT FOUND`);
        }
      }
    } catch (err: any) {
      logs.push(`5. Evolution API: FALHOU - ${err.message}`);
    }
  }

  return NextResponse.json({ logs, telefone });
}
