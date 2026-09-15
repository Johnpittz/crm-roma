import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { enviarMensagemWhatsApp } from "@/lib/evolution-api";

export const dynamic = "force-dynamic";

// GET /api/atendimentos/mensagens?atendimento_id=xxx
export async function GET(request: NextRequest) {
  const supabaseUser = await createClient();
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const atendimentoId = searchParams.get("atendimento_id");

  if (!atendimentoId) {
    return NextResponse.json({ error: "atendimento_id é obrigatório" }, { status: 400 });
  }

  const supabaseAdmin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: mensagens, error } = await supabaseAdmin
    .from("atendimento_mensagens")
    .select("*")
    .eq("atendimento_id", atendimentoId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ mensagens: mensagens || [] });
}

// POST /api/atendimentos/mensagens
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const {
    atendimento_id,
    conteudo,
    remetente = "vendedor",
    instance,
    media_url,
    media_type,
    file_name,
  } = body;

  if (!atendimento_id || !conteudo) {
    return NextResponse.json({ error: "atendimento_id e conteudo são obrigatórios" }, { status: 400 });
  }

  // Insert message into database
  const insertData: any = {
    atendimento_id,
    remetente,
    conteudo,
    enviada_por: user.id,
  };
  if (media_url) insertData.url_midia = media_url;
  if (media_type) insertData.tipo_midia = media_type;
  if (file_name) insertData.file_name = file_name;

  const { data: mensagem, error } = await supabase
    .from("atendimento_mensagens")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update atendimento with last message info
  const updateData: any = {
    ultima_mensagem: conteudo,
    ultima_mensagem_data: new Date().toISOString(),
    ultima_mensagem_remetente: remetente,
  };
  if (remetente === "vendedor") {
    updateData.vendedor_interagiu = true;
  }

  await supabase
    .from("atendimentos")
    .update(updateData)
    .eq("id", atendimento_id);

  // Send via WhatsApp if vendor is replying (skip if media already sent)
  const isMediaPlaceholder = conteudo.match(/^\[(Áudio|audio|Imagem|image|Vídeo|video|Sticker|sticker|Documento|document)\]$/i);
  if (remetente === "vendedor" && process.env.EVOLUTION_API_KEY && !isMediaPlaceholder) {
    try {
      // Get atendimento info (phone + instance)
      const { data: atendimento } = await supabase
        .from("atendimentos")
        .select("telefone_cliente, instance_name")
        .eq("id", atendimento_id)
        .single();

      if (atendimento?.telefone_cliente) {
        const instanceName = instance || atendimento.instance_name || "ROMA_1";

        const resultado = await enviarMensagemWhatsApp({
          telefone: atendimento.telefone_cliente,
          mensagem: conteudo,
          instance: instanceName,
        });

        if (resultado.success && resultado.message_id) {
          await supabase
            .from("atendimento_mensagens")
            .update({ whatsapp_message_id: resultado.message_id })
            .eq("id", mensagem.id);
        } else if (!resultado.success) {
          console.error("[Mensagens] Erro ao enviar via Evolution API:", resultado.error);
        }
      }
    } catch (err) {
      console.error("[Mensagens] Erro ao enviar via Evolution API:", err);
    }
  }

  return NextResponse.json({ success: true, mensagem });
}
