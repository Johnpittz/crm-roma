import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Cria uma URL assinada para o cliente enviar arquivos DIRETO ao Supabase Storage,
 * contornando o limite de 4,5 MB do corpo de requisição da Vercel
 * (Fase 8 — E2E; ver docs/plano-implementacao-waha.md).
 *
 * Fluxo (chat-inline):
 * 1. POST /api/upload-url { fileName } → { path, token }
 * 2. supabase.storage.from('chat-media').uploadToSignedUrl(path, token, file)
 * 3. POST /api/send/media { media_url } → WAHA baixa por URL (file:{url})
 */
export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !data?.user) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const { fileName } = await request.json();
    if (!fileName) {
      return NextResponse.json({ error: "fileName é obrigatório" }, { status: 400 });
    }

    // Nome higienizado + prefixo único para não colidir
    const seguro = String(fileName).replace(/[^\w.\-]/g, "_").slice(-80);
    const path = `enviados/${Date.now()}-${seguro}`;

    const { data: signed, error: signErr } = await admin.storage
      .from("chat-media")
      .createSignedUploadUrl(path);

    if (signErr || !signed) {
      return NextResponse.json(
        { error: signErr?.message || "Erro ao criar URL de upload" },
        { status: 500 }
      );
    }

    return NextResponse.json({ path: signed.path, token: signed.token });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao criar URL de upload" },
      { status: 500 }
    );
  }
}
