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
    const pushName = dados.nome || null;

    // Determinar remetente: fromMe=true é o vendedor (mandou do celular)
    const remetente = dados.fromMe ? "vendedor" : "cliente";

    // Usar timestamp real do WhatsApp para ordenação correta
    const createdAtWhatsApp = dados.messageTimestamp 
      ? new Date(dados.messageTimestamp * 1000).toISOString()
      : new Date().toISOString();

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

    // ==================== RESOLVER NOME DO CLIENTE ====================
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
          ultima_mensagem_remetente: remetente,
          nao_lido: true,
          cliente_id: cliente?.id || atendimentoExistente.cliente_id,
          vendedor_id: vendedorUpdate,
        })
        .eq("id", atendimentoExistente.id);

      // Insere mensagem no chat
      await getSupabase().from("atendimento_mensagens").insert({
        atendimento_id: atendimentoExistente.id,
        remetente: remetente,
        conteudo: conteudoMensagem,
        enviada_por: null,
        tipo_midia: mapearTipoMidia(dados.mediaType),
        url_midia: urlFinalMidia,
        whatsapp_message_id: dados.messageId || null,
        created_at: createdAtWhatsApp,
      });

      console.log(`[Webhook Evolution] Mensagem adicionada ao atendimento ${atendimentoExistente.id}`);

      // Chama AI Sales pra responder (só pra mensagens de texto do cliente)
      if (remetente === "cliente" && !dados.mediaType && conteudoMensagem) {
        console.log(`[Webhook Evolution] Disparando AI Sales para atendimento existente ${atendimentoExistente.id}`);
        chamarAISales(telefoneLimpo, instanceName).catch((e) => console.error("[AI Sales] Erro na chamada:", e));
      }

      return NextResponse.json({ success: true, atendimento_id: atendimentoExistente.id, action: "updated" });
    }

    // ==================== NOVO ATENDIMENTO ====================
    // Nome: 1) do banco (se cadastrado) > 2) pushName (se mensagem do cliente) > 3) "Cliente"
    // NÃO usa pushName quando fromMe=true (é o nome do vendedor)
    const nomeResolvido = cliente?.nome_razao_social
      || (!dados.fromMe && pushName ? pushName.trim() : null)
      || "Cliente";

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
        nome_cliente: nomeResolvido,
        status: "aberto",
        prioridade: cliente ? "normal" : "alta",
        assunto: conteudoMensagem.substring(0, 100),
        ultima_mensagem: conteudoMensagem,
        ultima_mensagem_data: new Date().toISOString(),
        ultima_mensagem_remetente: remetente,
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
      remetente: remetente,
      conteudo: conteudoMensagem,
      enviada_por: null,
      tipo_midia: mapearTipoMidia(dados.mediaType),
      url_midia: urlFinalMidia,
      whatsapp_message_id: dados.messageId || null,
      created_at: createdAtWhatsApp,
    });

    console.log(`[Webhook Evolution] Novo atendimento criado: ${novoAtendimento.id}`);

    // Chama AI Sales pra responder (só pra mensagens de texto do cliente)
    if (remetente === "cliente" && !dados.mediaType && conteudoMensagem) {
      console.log(`[Webhook Evolution] Disparando AI Sales para novo atendimento ${novoAtendimento.id}`);
      chamarAISales(telefoneLimpo, instanceName).catch((e) => console.error("[AI Sales] Erro na chamada:", e));
    }

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

// ==================== EXTRATOR DE MÍDIA ====================

/**
 * Mapeia tipo de mídia (inglês) para o valor aceito pelo CHECK constraint do banco.
 * Constraint: 'texto', 'audio', 'imagem', 'documento'
 */
function mapearTipoMidia(tipo: string | null): string | null {
  if (!tipo) return null;
  const mapa: Record<string, string> = {
    image: "imagem",
    audio: "audio",
    video: "video",
    sticker: "sticker",
    document: "documento",
    texto: "texto",
    imagem: "imagem",
    documento: "documento",
  };
  return mapa[tipo] || tipo;
}

/**
 * Extract base64 data from a media message object.
 * Checks multiple possible field locations used by different
 * Evolution API versions and configurations.
 */
function extractMediaBase64(mediaMessage: any): string | null {
  if (!mediaMessage) return null;
  // Primary: message.data (webhookBase64=true)
  if (mediaMessage.data) return mediaMessage.data;
  // Alternative field name
  if (mediaMessage.base64) return mediaMessage.base64;
  // Fallback: thumbnail data (lower quality but still usable)
  if (mediaMessage.jpgThumbnail) return mediaMessage.jpgThumbnail;
  if (mediaMessage.pngThumbnail) return mediaMessage.pngThumbnail;
  return null;
}

/**
 * Recursively search for a media message type inside wrapper objects.
 * Evolution API wraps certain message types (viewOnceMessage, ephemeralMessage,
 * viewOnceMessageV2, editedMessage) in an additional layer:
 *   { viewOnceMessage: { message: { imageMessage: {...} } } }
 *
 * @param obj - The message object to search (usually msg.message)
 * @param targetKey - The message type key to find (e.g. "imageMessage")
 * @param maxDepth - Maximum recursion depth (default 3)
 * @returns The found media message object or null
 */
function findMediaType(obj: any, targetKey: string, maxDepth = 3): any {
  if (!obj || typeof obj !== "object" || maxDepth <= 0) return null;

  // Direct match at this level
  if (obj[targetKey]) return obj[targetKey];

  // Known wrapper keys used by WhatsApp/Evolution API
  const wrapperKeys = [
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
    "ephemeralMessage",
    "editedMessage",
    "botInvokeMessage",
    "message",       // generic nesting
  ];

  for (const key of wrapperKeys) {
    if (obj[key]) {
      // Some wrappers have the actual message under a nested .message property
      const inner = obj[key].message || obj[key];
      const result = findMediaType(inner, targetKey, maxDepth - 1);
      if (result) return result;
    }
  }

  // Generic fallback: scan all object values one level deeper
  for (const key of Object.keys(obj)) {
    if (wrapperKeys.includes(key)) continue; // already checked above
    const val = obj[key];
    if (val && typeof val === "object") {
      const result = findMediaType(val, targetKey, maxDepth - 1);
      if (result) return result;
    }
  }

  return null;
}

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
    
    // Se a mensagem foi enviada por nós (vendedor), pular
    const fromMe = msg.key?.fromMe || false;
    
    // Timestamp real da mensagem (quando foi enviada no WhatsApp)
    const messageTimestamp = msg.messageTimestamp || null;
    
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
      console.log("[Webhook Evolution] MSG_KEYS:", JSON.stringify(msgKeys));

      // --- PHASE 1: Direct message type checks ---
      // Mensagem de texto
      if (msg.message.conversation) {
        mensagem = msg.message.conversation;
      } else if (msg.message.extendedTextMessage?.text) {
        mensagem = msg.message.extendedTextMessage.text;
      }
      // Imagem
      else if (msg.message.imageMessage) {
        mediaType = "image";
        mediaBase64 = extractMediaBase64(msg.message.imageMessage);
        mediaUrl = msg.message.imageMessage.url || null;
        mensagem = msg.message.imageMessage.caption || "[Imagem]";
      }
      // Áudio
      else if (msg.message.audioMessage) {
        mediaType = "audio";
        mediaBase64 = extractMediaBase64(msg.message.audioMessage);
        mediaUrl = msg.message.audioMessage.url || null;
        mensagem = "[Áudio]";
      }
      // Vídeo
      else if (msg.message.videoMessage) {
        mediaType = "video";
        mediaBase64 = extractMediaBase64(msg.message.videoMessage);
        mediaUrl = msg.message.videoMessage.url || null;
        mensagem = msg.message.videoMessage.caption || "[Vídeo]";
      }
      // Sticker
      else if (msg.message.stickerMessage) {
        mediaType = "sticker";
        mediaBase64 = extractMediaBase64(msg.message.stickerMessage);
        mediaUrl = msg.message.stickerMessage.url || null;
        mensagem = "[Sticker]";
      }
      // Documento
      else if (msg.message.documentMessage) {
        mediaType = "document";
        mediaBase64 = extractMediaBase64(msg.message.documentMessage);
        mediaUrl = msg.message.documentMessage.url || null;
        mensagem = msg.message.documentMessage.fileName || "[Documento]";
      }

      // --- PHASE 2: Wrapped message type detection ---
      // If no type was detected yet, search recursively for wrapped types
      // (viewOnceMessage, ephemeralMessage, editedMessage, etc.)
      if (!mediaType && !mensagem) {
        console.log("[Webhook Evolution] No direct match — searching wrapped message types...");
        const mediaTypeMap: [string, string][] = [
          ["imageMessage", "image"],
          ["audioMessage", "audio"],
          ["videoMessage", "video"],
          ["stickerMessage", "sticker"],
          ["documentMessage", "document"],
        ];

        for (const [msgKey, typeLabel] of mediaTypeMap) {
          const found = findMediaType(msg.message, msgKey);
          if (found) {
            console.log(`[Webhook Evolution] Found ${msgKey} inside wrapped message`);
            mediaType = typeLabel;
            mediaBase64 = extractMediaBase64(found);
            mediaUrl = found.url || null;

            if (typeLabel === "image" || typeLabel === "video") {
              mensagem = found.caption || `[${typeLabel}]`;
            } else if (typeLabel === "audio") {
              mensagem = "[Áudio]";
            } else if (typeLabel === "sticker") {
              mensagem = "[Sticker]";
            } else if (typeLabel === "document") {
              mensagem = found.fileName || "[Documento]";
            }
            break;
          }
        }

        if (!mediaType) {
          console.log("[Webhook Evolution] STILL no type detected. Full message keys:");
          console.log("[Webhook Evolution] msg.message keys:", JSON.stringify(Object.keys(msg.message)));
          console.log("[Webhook Evolution] msg.message snapshot:", JSON.stringify(msg.message).substring(0, 800));
        }
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
      fromMe,
      messageTimestamp,
    };
  }
  
  // Evento de conexão (ignorar)
  if (payload.event === "connection.update") {
    console.log("[Webhook Evolution] Evento de conexão ignorado");
    return { remoteJid: null, telefone: null, nome: null, mensagem: null, mediaType: null, mediaUrl: null, mediaBase64: null, messageId: null, instance, fromMe: false, messageTimestamp: null };
  }

  // Evento desconhecido
  console.log("[Webhook Evolution] Evento desconhecido:", payload.event);
  return { remoteJid: null, telefone: null, nome: null, mensagem: null, mediaType: null, mediaUrl: null, mediaBase64: null, messageId: null, instance, fromMe: false, messageTimestamp: null };
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

/**
 * Envia mensagem de texto via Evolution API
 */
async function evolutionEnviarMensagem(instanceName: string, telefone: string, mensagem: string): Promise<boolean> {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!apiUrl || !apiKey) return false;

  try {
    const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
      },
      body: JSON.stringify({
        number: telefone,
        text: mensagem,
      }),
    });
    return response.ok;
  } catch (err) {
    console.error("[Evolution Send] Erro:", err);
    return false;
  }
}

/**
 * Chama o AI Sales pra responder o cliente e possívelmente criar tarefa no kanban
 */
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 * Chama Gemini direto (sem self-call HTTP) pra responder o cliente
 */
async function chamarAISales(telefone: string, instanceName: string | null) {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log(`[AI Sales] Iniciando para ${telefone}, instance=${instanceName}, apiKey=${apiKey ? "PRESENTE" : "AUSENTE"}`);
  if (!apiKey) {
    console.log("[AI Sales] GEMINI_API_KEY não configurada, pulando");
    return;
  }

  try {
    // 1. Busca atendimento aberto
    console.log(`[AI Sales] Buscando atendimento para ${telefone}`);
    let query = getSupabase()
      .from("atendimentos")
      .select("id, nome_cliente")
      .eq("telefone_cliente", telefone)
      .eq("status", "aberto");
    if (instanceName) query = query.eq("instance_name", instanceName);

    const { data: atendimento, error: errAtend } = await query.single();
    console.log(`[AI Sales] Atendimento encontrado:`, atendimento ? `${atendimento.id} (${atendimento.nome_cliente})` : "NENHUM", errAtend ? `erro: ${errAtend.message}` : "");
    if (!atendimento) return;

    // 2. Busca últimas 20 mensagens
    const { data: mensagens } = await getSupabase()
      .from("atendimento_mensagens")
      .select("remetente, conteudo")
      .eq("atendimento_id", atendimento.id)
      .order("created_at", { ascending: true })
      .limit(20);

    if (!mensagens || mensagens.length === 0) return;

    const nomeCliente = atendimento.nome_cliente || "Cliente";
    const msgList = mensagens as { remetente: string; conteudo: string }[];
    const historico = msgList.map((m) =>
      `${m.remetente === "cliente" ? "Cliente" : "Vendedor"}: ${m.conteudo}`
    ).join("\n");

    // 3. Chama Gemini
    const geminiPrompt = montarPromptVendas(nomeCliente, historico);
    console.log(`[AI Sales] Chamando Gemini para ${nomeCliente}...`);
    const geminiResp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: geminiPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
      }),
      signal: AbortSignal.timeout(15000),
    });

    const geminiData = await geminiResp.json();
    const textoResposta = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log(`[AI Sales] Gemini respondeu:`, textoResposta ? `"${textoResposta.substring(0, 80)}..."` : "VAZIO", `status=${geminiResp.status}`);

    if (!textoResposta) return;

    // 4. Envia resposta pro cliente
    if (instanceName) {
      const enviou = await evolutionEnviarMensagem(instanceName, telefone, textoResposta);
      console.log(`[AI Sales] Resposta enviada para ${telefone}: ${enviou ? "OK" : "FALHOU"}`);
    }

    // 5. Analisa se deve criar tarefa no kanban
    const oportunidade = await analisarOportunidadeIA(apiKey, nomeCliente, historico, textoResposta);
    if (oportunidade.criar && oportunidade.titulo) {
      await criarTarefaKanban({
        titulo: oportunidade.titulo,
        descricao: oportunidade.descricao || `Oportunidade para ${nomeCliente}`,
        prioridade: oportunidade.prioridade || "media",
        cliente_nome: nomeCliente,
      }, instanceName);
    }

  } catch (err) {
    console.error("[AI Sales] Erro:", err);
  }
}

/**
 * Cria tarefa no Kanban via service_role
 */
async function criarTarefaKanban(tarefa: {
  titulo: string;
  descricao: string;
  prioridade: string;
  cliente_nome: string;
}, instanceName: string | null) {
  try {
    // Busca vendedor do atendimento mais recente desta instância
    const { data: atendimento } = await getSupabase()
      .from("atendimentos")
      .select("vendedor_id")
      .eq("instance_name", instanceName)
      .eq("status", "aberto")
      .order("ultima_mensagem_data", { ascending: false })
      .limit(1)
      .single();

    const vendedorId = atendimento?.vendedor_id;
    if (!vendedorId) {
      console.log("[AI Sales] Sem vendedor para atribuir tarefa");
      return;
    }

    // Pega maior ordem da coluna
    const { data: ultimaOrdem } = await getSupabase()
      .from("tarefas")
      .select("ordem")
      .eq("vendedor_id", vendedorId)
      .eq("coluna_kanban", "a_fazer")
      .order("ordem", { ascending: false })
      .limit(1)
      .single();

    const novaOrdem = (ultimaOrdem?.ordem || 0) + 1;

    await getSupabase().from("tarefas").insert({
      vendedor_id: vendedorId,
      titulo: tarefa.titulo,
      descricao: tarefa.descricao || `Oportunidade identificada pela IA para ${tarefa.cliente_nome}`,
      tipo: "oportunidade",
      prioridade: tarefa.prioridade || "media",
      status: "pendente",
      coluna_kanban: "a_fazer",
      ordem: novaOrdem,
      cliente_nome: tarefa.cliente_nome,
      data_inicio: new Date().toISOString().split("T")[0],
    });

    console.log(`[AI Sales] Tarefa criada: ${tarefa.titulo}`);
  } catch (err) {
    console.error("[AI Sales] Erro ao criar tarefa:", err);
  }
}

/**
 * Monta prompt de vendas da Roma Distribuidora
 */
function montarPromptVendas(nomeCliente: string, historico: string): string {
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
 * Analisa se a conversa indica oportunidade de venda
 */
async function analisarOportunidadeIA(
  apiKey: string,
  nomeCliente: string,
  historico: string,
  ultimaResposta: string
): Promise<{ criar: boolean; titulo?: string; descricao?: string; prioridade?: string }> {
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


