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

  // Step 2: Check WAHA config
  const wahaUrl = process.env.WAHA_API_URL;
  const wahaKey = process.env.WAHA_API_KEY;
  const wahaSession = process.env.WAHA_SESSION;
  logs.push(`2. WAHA_API_URL: ${wahaUrl || "AUSENTE ❌"}`);
  logs.push(`3. WAHA_API_KEY: ${wahaKey ? `PRESENTE (${wahaKey.substring(0, 10)}...)` : "AUSENTE ❌"}`);
  logs.push(`   WAHA_SESSION: ${wahaSession || "ROMA_1 (padrão)"}`);

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

  // Step 4: Test WAHA connectivity (sessions + status)
  if (wahaUrl && wahaKey) {
    try {
      const resp = await fetch(`${wahaUrl}/api/sessions`, {
        headers: { "X-Api-Key": wahaKey },
      });
      logs.push(`5. WAHA connectivity: ${resp.status}`);
      if (resp.ok) {
        const sessions = await resp.json();
        for (const s of sessions) {
          logs.push(`   Sessão ${s.name}: status=${s.status}`);
        }
        const alvo = sessions.find((s: any) => s.name === (wahaSession || "ROMA_1"));
        logs.push(
          alvo
            ? `   ${alvo.name} encontrada: ${alvo.status}`
            : `   ${wahaSession || "ROMA_1"} NOT FOUND`
        );
      }
    } catch (err: any) {
      logs.push(`5. WAHA: FALHOU - ${err.message}`);
    }
  }

  return NextResponse.json({ logs, telefone });
}
