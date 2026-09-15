/**
 * Webhook para receber mensagens do WhatsApp via Evolution API
 * 
 * Endpoint: POST /api/webhooks/evolution
 * 
 * Quando um cliente envia mensagem no WhatsApp, a Evolution API envia
 * um payload para este endpoint. O sistema:
 * 1. Identifica/cria o atendimento pelo telefone + instância
 * 2. Insere a mensagem no chat (com suporte a mídia base64)
 * 3. Atualiza o status do atendimento
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Cliente Supabase lazy (service_role para bypassar RLS)
let supabaseInstance: any = null;
function getSupabase() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase URL e Service Role Key são obrigatórios");
    }
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

// ==================== UPLOAD DE MÍDIA ====================

/**
 * Faz upload de mídia base64 para o Supabase Storage (bucket chat-media)
 * e retorna a URL pública.
 */
async function uploadMediaToStorage(
  base64Data: string,
  mimeType: string,
  fileName: string
): Promise<string | null> {
  try {
    const folder = "whatsapp";
    const buffer = Buffer.from(base64Data, "base64");

    const { data, error } = await getSupabase()
      .storage
      .from("chat-media")
      .upload(`${folder}/${fileName}`, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error("[Webhook Evolution] Erro upload storage:", error);
      return null;
    }

    const { data: urlData } = getSupabase()
      .storage
      .from("chat-media")
      .getPublicUrl(`${folder}/${fileName}`);

    return urlData?.publicUrl || null;
  } catch (err: any) {
    console.error("[Webhook Evolution] Erro upload mídia:", err.message);
    return null;
  }
}

// ==================== HANDLER PRINCIPAL ====================

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limit: 60 webhooks por minuto por IP
    const limit = rateLimit(request, { max: 60, windowMs: 60_000 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    // 2. Parse do payload da Evolution API
    const payload = await request.json();

    // 3. Validação básica do payload
    if (!payload.event || !payload.data) {
      return NextResponse.json(
        { error: "Payload inválido: event e data são obrigatórios" },
        { status: 400 }
      );
    }

    // Log para debug
    console.log("[Webhook Evolution] Evento:", payload.event);
    console.log("[Webhook Evolution] Instance:", payload.instance);

    // 4. Extrair dados do payload da Evolution API
    const dados = extrairDadosEvolutionAPI(payload);

    // Ignorar mensagens de GRUPO (remoteJid termina em @g.us)
    if (dados.remoteJid && dados.remoteJid.endsWith("@g.us")) {
      console.log("[Webhook Evolution] Mensagem de grupo ignorada:", dados.remoteJid);
      return NextResponse.json({ success: true, action: "ignored_group" });
    }

    if (!dados.telefone) {
      console.error("[Webhook Evolution] Telefone não encontrado no payload");
      return NextResponse.json(
        { error: "Telefone não encontrado no payload" },
        { status: 400 }
      );
    }

    const telefoneLimpo = telefoneParaDigitos(dados.telefone);
    const instanceName = dados.instance || null;
    const mensagem = dados.mensagem || "";
    const nomeCliente = dados.nome || null;

    // Verificar se tem mídia
    const temMidia = dados.mediaType !== null;
    const conteudoMensagem = temMidia ? `[${dados.mediaType}]` : mensagem;

    // Aceita mensagens vazias se tiver mídia
    if (!conteudoMensagem && !temMidia) {
      console.error("[Webhook Evolution] Mensagem vazia e sem mídia");
      return NextResponse.json(
        { error: "Mensagem vazia" },
        { status: 400 }
      );
    }

    // ==================== DEDUP ====================
    // Se já existe mensagem com este whatsapp_message_id, ignorar
    if (dados.messageId) {
      const { data: existente } = await getSupabase()
        .from("atendimento_mensagens")
        .select("id")
        .eq("whatsapp_message_id", dados.messageId)
        .limit(1)
        .maybeSingle();

      if (existente) {
        console.log("[Webhook Evolution] Mensagem duplicada ignorada:", dados.messageId);
        return NextResponse.json({ success: true, action: "dedup_skipped" });
      }
    }

    // ==================== UPLOAD DE MÍDIA ====================
    let urlFinalMidia = dados.mediaUrl || null;

    if (dados.mediaBase64 && dados.mediaType) {
      const extensao = obterExtensao(dados.mediaType);
      const fileName = `${telefoneLimpo}_${Date.now()}${extensao}`;
      const mimeType = obterMimeType(dados.mediaType);
      const uploadedUrl = await uploadMediaToStorage(dados.mediaBase64, mimeType, fileName);
      if (uploadedUrl) {
        urlFinalMidia = uploadedUrl;
      }
    }

    // ==================== BUSCA CLIENTE ====================
    const cliente = await buscarClientePorTelefone(telefoneLimpo);

    // ==================== ATENDIMENTO EXISTENTE ====================
    const atendimentoExistente = await buscarAtendimentoAberto(telefoneLimpo, instanceName);

    if (atendimentoExistente) {
      // Se atendimento não tem vendedor, tenta atribuir (cliente ou padrão)
      let vendedorUpdate = atendimentoExistente.vendedor_id;
      if (!vendedorUpdate) {
        vendedorUpdate = cliente?.vendedor_responsavel_id || await buscarVendedorPadrao() || null;
        console.log(`[Webhook Evolution] Atendimento ${atendimentoExistente.id} sem vendedor → atribuindo: ${vendedorUpdate}`);
      }

      await getSupabase()
        .from("atendimentos")
        .update({
          ultima_mensagem: conteudoMensagem,
          ultima_mensagem_data: new Date().toISOString(),
          ultima_mensagem_remetente: "cliente",
          nao_lido: true,
          nome_cliente: nomeCliente || atendimentoExistente.nome_cliente,
          cliente_id: cliente?.id || atendimentoExistente.cliente_id,
          vendedor_id: vendedorUpdate,
        })
        .eq("id", atendimentoExistente.id);

      // Insere mensagem no chat
      await getSupabase().from("atendimento_mensagens").insert({
        atendimento_id: atendimentoExistente.id,
        remetente: "cliente",
        conteudo: conteudoMensagem,
        enviada_por: null,
        tipo_midia: dados.mediaType || null,
        url_midia: urlFinalMidia,
        whatsapp_message_id: dados.messageId || null,
      });

      console.log(`[Webhook Evolution] Mensagem adicionada ao atendimento ${atendimentoExistente.id}`);
      return NextResponse.json({ success: true, atendimento_id: atendimentoExistente.id, action: "updated" });
    }

    // ==================== NOVO ATENDIMENTO ====================
    const vendedorPadrao = await buscarVendedorPadrao();
    const vendedorFinal = cliente?.vendedor_responsavel_id || vendedorPadrao || null;

    console.log(`[Webhook Evolution] Roteamento: cliente_vendedor=${cliente?.vendedor_responsavel_id}, padrao=${vendedorPadrao}, final=${vendedorFinal}`);

    const { data: novoAtendimento, error: erroInsert } = await getSupabase()
      .from("atendimentos")
      .insert({
        cliente_id: cliente?.id || null,
        vendedor_id: vendedorFinal,
        canal: "whatsapp",
        telefone_cliente: telefoneLimpo,
        nome_cliente: nomeCliente || cliente?.nome_razao_social || "Cliente",
        status: "aberto",
        prioridade: cliente ? "normal" : "alta",
        assunto: conteudoMensagem.substring(0, 100),
        ultima_mensagem: conteudoMensagem,
        ultima_mensagem_data: new Date().toISOString(),
        ultima_mensagem_remetente: "cliente",
        nao_lido: true,
        instance_name: instanceName,
      })
      .select()
      .single();

    if (erroInsert) {
      console.error("[Webhook Evolution] Erro ao criar atendimento:", erroInsert);
      return NextResponse.json({ error: erroInsert.message }, { status: 500 });
    }

    // Insere mensagem inicial no chat
    await getSupabase().from("atendimento_mensagens").insert({
      atendimento_id: novoAtendimento.id,
      remetente: "cliente",
      conteudo: conteudoMensagem,
      enviada_por: null,
      tipo_midia: dados.mediaType || null,
      url_midia: urlFinalMidia,
      whatsapp_message_id: dados.messageId || null,
    });

    console.log(`[Webhook Evolution] Novo atendimento criado: ${novoAtendimento.id}`);
    return NextResponse.json({ success: true, atendimento_id: novoAtendimento.id, action: "created" });

  } catch (error: any) {
    console.error("[Webhook Evolution] Erro geral:", error);
    return NextResponse.json(
      { error: "Erro ao processar webhook", details: error.message },
      { status: 500 }
    );
  }
}

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Extrai dados do payload da Evolution API (webhookBase64 format)
 * 
 * Supports:
 * - messages.upsert events
 * - connection.update events
 * - Media via dados.mediaBase64 from data.message.{type}.data
 */
function extrairDadosEvolutionAPI(payload: any) {
  const instance = payload.instance || null;
  
  // Evento de mensagem
  if (payload.event === "messages.upsert" || payload.event === "messages.update") {
    const msg = payload.data;
    
    // Remote JID (telefone do remetente)
    const remoteJid = msg.key?.remoteJid || null;
    
    // Extrair telefone do remoteJid
    let telefone = null;
    if (remoteJid && !remoteJid.endsWith("@g.us")) {
      telefone = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "");
    }
    
    // Nome do push (quem enviou)
    const nome = msg.pushName || msg.notifyName || null;
    
    // Message ID for dedup
    const messageId = msg.key?.id || null;
    
    // Conteúdo da mensagem
    let mensagem = null;
    let mediaType = null;
    let mediaUrl = null;
    let mediaBase64 = null;
    
    if (msg.message) {
      // DEBUG: log message keys to understand payload structure
      const msgKeys = Object.keys(msg.message);
      if (!msgKeys.includes('conversation') && !msgKeys.includes('extendedTextMessage')) {
        console.log("[Webhook Evolution] MSG_KEYS:", JSON.stringify(msgKeys));
        console.log("[Webhook Evolution] MSG_SAMPLE:", JSON.stringify(msg.message).substring(0, 500));
      }
      // Mensagem de texto
      if (msg.message.conversation) {
        mensagem = msg.message.conversation;
      } else if (msg.message.extendedTextMessage?.text) {
        mensagem = msg.message.extendedTextMessage.text;
      } 
      // Imagem
      else if (msg.message.imageMessage) {
        mediaType = "image";
        // Try base64 data first, then URL
        mediaBase64 = msg.message.imageMessage.data || null;
        mediaUrl = msg.message.imageMessage.url || null;
        mensagem = msg.message.imageMessage.caption || "[Imagem]";
      }
      // Áudio
      else if (msg.message.audioMessage) {
        mediaType = "audio";
        mediaBase64 = msg.message.audioMessage.data || null;
        mediaUrl = msg.message.audioMessage.url || null;
        mensagem = "[Áudio]";
      }
      // Vídeo
      else if (msg.message.videoMessage) {
        mediaType = "video";
        mediaBase64 = msg.message.videoMessage.data || null;
        mediaUrl = msg.message.videoMessage.url || null;
        mensagem = msg.message.videoMessage.caption || "[Vídeo]";
      }
      // Sticker
      else if (msg.message.stickerMessage) {
        mediaType = "sticker";
        mediaBase64 = msg.message.stickerMessage.data || null;
        mediaUrl = msg.message.stickerMessage.url || null;
        mensagem = "[Sticker]";
      }
      // Documento
      else if (msg.message.documentMessage) {
        mediaType = "document";
        mediaBase64 = msg.message.documentMessage.data || null;
        mediaUrl = msg.message.documentMessage.url || null;
        mensagem = msg.message.documentMessage.fileName || "[Documento]";
      }
    }
    
    // Se mensagem é null e tem mídia, usar tipo
    if (!mensagem && mediaType) {
      mensagem = `[${mediaType}]`;
    }
    
    return {
      remoteJid,
      telefone,
      nome,
      mensagem,
      mediaType,
      mediaUrl,
      mediaBase64,
      messageId,
      instance,
    };
  }
  
  // Evento de conexão (ignorar)
  if (payload.event === "connection.update") {
    console.log("[Webhook Evolution] Evento de conexão ignorado");
    return { remoteJid: null, telefone: null, nome: null, mensagem: null, mediaType: null, mediaUrl: null, mediaBase64: null, messageId: null, instance };
  }
  
  // Evento desconhecido
  console.log("[Webhook Evolution] Evento desconhecido:", payload.event);
  return { remoteJid: null, telefone: null, nome: null, mensagem: null, mediaType: null, mediaUrl: null, mediaBase64: null, messageId: null, instance };
}

/**
 * Converte telefone para apenas dígitos
 */
function telefoneParaDigitos(telefone: string): string {
  return telefone.replace(/\D/g, "");
}

/**
 * Busca cliente pelo telefone no banco de dados
 */
async function buscarClientePorTelefone(telefoneLimpo: string) {
  const { data: clientesCandidatos } = await getSupabase()
    .from("clientes")
    .select("id, vendedor_responsavel_id, nome_razao_social, telefone, celular")
    .or(`telefone.ilike.%${telefoneLimpo.substring(0, 6)}%,celular.ilike.%${telefoneLimpo.substring(0, 6)}%`)
    .limit(50);

  if (!clientesCandidatos || clientesCandidatos.length === 0) return null;

  // Filtra comparando só dígitos
  return clientesCandidatos.find((c: any) => {
    const telLimpo = (c.telefone || "").replace(/\D/g, "");
    const celLimpo = (c.celular || "").replace(/\D/g, "");
    return (
      telLimpo === telefoneLimpo ||
      celLimpo === telefoneLimpo ||
      telLimpo.endsWith(telefoneLimpo) ||
      celLimpo.endsWith(telefoneLimpo) ||
      telefoneLimpo.endsWith(telLimpo) ||
      telefoneLimpo.endsWith(celLimpo)
    );
  }) || null;
}

/**
 * Busca atendimento aberto existente para o telefone + instância
 * Both exact and fallback queries filter by instance_name
 */
async function buscarAtendimentoAberto(telefoneLimpo: string, instanceName: string | null) {
  // Primeiro: busca exata (rápida) — filtra por telefone E instância
  const { data: exato } = await getSupabase()
    .from("atendimentos")
    .select("id, nome_cliente, cliente_id, vendedor_id, instance_name")
    .eq("telefone_cliente", telefoneLimpo)
    .eq("status", "aberto")
    .eq("instance_name", instanceName)
    .limit(1)
    .single();

  if (exato) return exato;

  // Segundo: busca ampla — compara apenas os últimos 8 dígitos (tolerante a formatos)
  // Também filtra por instance_name
  const ultimos8 = telefoneLimpo.slice(-8);
  if (ultimos8.length < 8) return null;

  const { data: candidatos } = await getSupabase()
    .from("atendimentos")
    .select("id, nome_cliente, cliente_id, vendedor_id, telefone_cliente, instance_name")
    .eq("status", "aberto")
    .eq("instance_name", instanceName)
    .order("ultima_mensagem_data", { ascending: false })
    .limit(50);

  if (!candidatos || candidatos.length === 0) return null;

  const encontrado = candidatos.find((a: any) => {
    const telBanco = (a.telefone_cliente || "").replace(/\D/g, "");
    const ultimos8Banco = telBanco.slice(-8);
    return ultimos8Banco === ultimos8 && ultimos8Banco.length >= 8;
  });

  return encontrado || null;
}

/**
 * Busca vendedor padrão para roteamento
 */
async function buscarVendedorPadrao() {
  const { data } = await getSupabase()
    .from("profiles")
    .select("id")
    .eq("cargo", "vendedor")
    .eq("status", "ativo")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  return data?.id || null;
}

/**
 * Retorna extensão de arquivo baseada no tipo de mídia
 */
function obterExtensao(mediaType: string): string {
  switch (mediaType) {
    case "image": return ".jpg";
    case "audio": return ".ogg";
    case "video": return ".mp4";
    case "sticker": return ".webp";
    case "document": return ".bin";
    default: return ".bin";
  }
}

/**
 * Retorna MIME type baseado no tipo de mídia
 */
function obterMimeType(mediaType: string): string {
  switch (mediaType) {
    case "image": return "image/jpeg";
    case "audio": return "audio/ogg";
    case "video": return "video/mp4";
    case "sticker": return "image/webp";
    case "document": return "application/octet-stream";
    default: return "application/octet-stream";
  }
}
