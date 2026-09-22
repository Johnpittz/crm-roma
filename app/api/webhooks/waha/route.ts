/**
 * Webhook para receber mensagens do WhatsApp via WAHA
 * 
 * Endpoint: POST /api/webhooks/waha
 * 
 * WAHA envia eventos quando mensagens chegam no WhatsApp.
 * Evento principal: "message"
 * 
 * Docs: https://waha.devlike.pro/docs/how-to/receive-messages/
 * Docs: https://waha.devlike.pro/docs/how-to/events/
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { montarPromptVendas } from "@/lib/ai-sales-prompts/vendas";
import { analisarOportunidadeIA } from "@/lib/ai-sales-prompts/oportunidades";
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
      console.error("[Webhook WAHA] Erro upload storage:", error);
      return null;
    }

    const { data: urlData } = getSupabase()
      .storage
      .from("chat-media")
      .getPublicUrl(`${folder}/${fileName}`);

    return urlData?.publicUrl || null;
  } catch (err: any) {
    console.error("[Webhook WAHA] Erro upload mídia:", err.message);
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

    // 2. Parse do payload da WAHA
    const payload = await request.json();

    // 3. Validação básica do payload
    if (!payload.event) {
      return NextResponse.json(
        { error: "Payload inválido: event é obrigatório" },
        { status: 400 }
      );
    }

    // Log para debug
    console.log("[Webhook WAHA] Evento:", payload.event);
    console.log("[Webhook WAHA] Session:", payload.session);

    // 4. Processar apenas eventos de mensagem
    if (payload.event !== "message") {
      console.log("[Webhook WAHA] Evento ignorado:", payload.event);
      return NextResponse.json({ success: true, action: "ignored_event" });
    }

    // 5. Extrair dados do payload da WAHA
    const dados = extrairDadosWAHA(payload);

    // Ignorar mensagens de GRUPO (chatId termina em @g.us)
    if (dados.chatId && dados.chatId.endsWith("@g.us")) {
      console.log("[Webhook WAHA] Mensagem de grupo ignorada:", dados.chatId);
      return NextResponse.json({ success: true, action: "ignored_group" });
    }

    if (!dados.telefone) {
      console.error("[Webhook WAHA] Telefone não encontrado no payload");
      return NextResponse.json(
        { error: "Telefone não encontrado no payload" },
        { status: 400 }
      );
    }

    const telefoneLimpo = telefoneParaDigitos(dados.telefone);
    const sessionName = dados.session || null;
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
      console.error("[Webhook WAHA] Mensagem vazia e sem mídia");
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
        console.log("[Webhook WAHA] Mensagem duplicada ignorada:", dados.messageId);
        return NextResponse.json({ success: true, action: "dedup_skipped" });
      }
    }

    // ==================== UPLOAD DE MÍDIA ====================
    let urlFinalMidia = dados.mediaUrl || null;

    if (dados.mediaBase64 && dados.mediaType) {
      const extensao = obterExtensao(dados.mediaType);
      const uploadFileName = `${telefoneLimpo}_${Date.now()}${extensao}`;
      const mimeType = obterMimeType(dados.mediaType);
      console.log(`[Webhook WAHA] Uploading ${dados.mediaType}: base64=${dados.mediaBase64.length}chars, mime=${mimeType}, file=${uploadFileName}`);
      const uploadedUrl = await uploadMediaToStorage(dados.mediaBase64, mimeType, uploadFileName);
      if (uploadedUrl) {
        urlFinalMidia = uploadedUrl;
        console.log(`[Webhook WAHA] Upload OK: ${uploadedUrl.substring(0, 80)}`);
      } else {
        console.log(`[Webhook WAHA] Upload FAILED - urlFinalMidia keeps: ${urlFinalMidia ? urlFinalMidia.substring(0, 80) : 'null'}`);
      }
    } else if (dados.mediaType) {
      console.log(`[Webhook WAHA] ${dados.mediaType} sem base64, usando URL: ${urlFinalMidia ? urlFinalMidia.substring(0, 80) : 'null'}`);
    }

    // ==================== BUSCA CLIENTE ====================
    const cliente = await buscarClientePorTelefone(telefoneLimpo);

    // ==================== ATENDIMENTO EXISTENTE ====================
    const atendimentoExistente = await buscarAtendimentoAberto(telefoneLimpo, sessionName);

    if (atendimentoExistente) {
      // Se atendimento não tem vendedor, tenta atribuir (cliente ou padrão)
      let vendedorUpdate = atendimentoExistente.vendedor_id;
      if (!vendedorUpdate) {
        vendedorUpdate = cliente?.vendedor_responsavel_id || await buscarVendedorPadrao() || null;
        console.log(`[Webhook WAHA] Atendimento ${atendimentoExistente.id} sem vendedor → atribuindo: ${vendedorUpdate}`);
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
      const insertResult = await getSupabase().from("atendimento_mensagens").insert({
        atendimento_id: atendimentoExistente.id,
        remetente: remetente,
        conteudo: conteudoMensagem,
        enviada_por: null,
        tipo_midia: mapearTipoMidia(dados.mediaType),
        url_midia: urlFinalMidia,
        file_name: dados.fileName || null,
        whatsapp_message_id: dados.messageId || null,
        created_at: createdAtWhatsApp,
      });

      if (insertResult.error) {
        console.error(`[Webhook WAHA] ERRO AO INSERIR MENSAGEM:`, insertResult.error);
      } else {
        console.log(`[Webhook WAHA] Mensagem inserida OK: tipo=${dados.mediaType}, file=${dados.fileName}, atendimento=${atendimentoExistente.id}`);
      }

      // Chama AI Sales pra responder (só pra mensagens de texto do cliente)
      if (remetente === "cliente" && !dados.mediaType && conteudoMensagem) {
        console.log(`[Webhook WAHA] Disparando AI Sales para atendimento existente ${atendimentoExistente.id}`);
        chamarAISales(telefoneLimpo, sessionName).catch((e) => console.error("[AI Sales] Erro na chamada:", e));
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

    console.log(`[Webhook WAHA] Roteamento: cliente_vendedor=${cliente?.vendedor_responsavel_id}, padrao=${vendedorPadrao}, final=${vendedorFinal}`);

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
        instance_name: sessionName,
      })
      .select()
      .single();

    if (erroInsert) {
      console.error("[Webhook WAHA] Erro ao criar atendimento:", erroInsert);
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
      file_name: dados.fileName || null,
      whatsapp_message_id: dados.messageId || null,
      created_at: createdAtWhatsApp,
    });

    console.log(`[Webhook WAHA] Novo atendimento criado: ${novoAtendimento.id}`);

    // Chama AI Sales pra responder (só pra mensagens de texto do cliente)
    if (remetente === "cliente" && !dados.mediaType && conteudoMensagem) {
      console.log(`[Webhook WAHA] Disparando AI Sales para novo atendimento ${novoAtendimento.id}`);
      chamarAISales(telefoneLimpo, sessionName).catch((e) => console.error("[AI Sales] Erro na chamada:", e));
    }

    return NextResponse.json({ success: true, atendimento_id: novoAtendimento.id, action: "created" });

  } catch (error: any) {
    console.error("[Webhook WAHA] Erro geral:", error);
    return NextResponse.json(
      { error: "Erro ao processar webhook", details: error.message },
      { status: 500 }
    );
  }
}

// ==================== FUNÇÕES AUXILIARES ====================

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
 * Extrai dados do payload da WAHA
 * 
 * WAHA format: { event: "message", session: "default", payload: { ... } }
 * 
 * O payload contém:
 * - chatId: "5511999999999@c.us" ou "5511999999999@g.us"
 * - from: "5511999999999@c.us" (quem enviou)
 * - fromMe: boolean
 * - body: texto da mensagem (para mensagens de texto)
 * - type: "text", "image", "audio", "video", "document", "sticker"
 * - caption: legenda (para imagem/vídeo)
 * - filename: nome do arquivo (para documentos)
 * - mimetype: tipo MIME do arquivo
 * - data: base64 do arquivo (se webhookBase64=true)
 * - url: URL do arquivo no CDN do WhatsApp
 * - timestamp: unix timestamp
 * - id: message ID (para dedup)
 * 
 * Docs: https://waha.devlike.pro/docs/how-to/events/
 */
function extrairDadosWAHA(payload: any) {
  const session = payload.session || null;
  const msg = payload.payload || payload.data || payload;

  // Chat ID (telefone + @c.us ou @g.us)
  const chatId = msg.chatId || msg.key?.remoteJid || null;

  // Extrair telefone do chatId
  let telefone = null;
  if (chatId && !chatId.endsWith("@g.us")) {
    telefone = chatId.replace("@c.us", "").replace("@s.whatsapp.net", "").replace("@lid", "");
  }

  // Nome do push (quem enviou)
  const nome = msg.pushName || msg.notifyName || null;

  // Se a mensagem foi enviada por nós (vendedor), pular
  const fromMe = msg.fromMe || msg.key?.fromMe || false;

  // Timestamp real da mensagem (quando foi enviada no WhatsApp)
  const messageTimestamp = msg.timestamp || msg.messageTimestamp || null;

  // Message ID for dedup
  const messageId = msg.id || msg.key?.id || null;

  // Conteúdo da mensagem
  let mensagem = null;
  let mediaType = null;
  let mediaUrl = null;
  let mediaBase64 = null;
  let fileName = null;

  // WAHA já entrega a mensagem parseada
  const msgType = msg.type || null;

  if (msgType === "text" || msgType === "chat") {
    // Mensagem de texto
    mensagem = msg.body || msg.text || null;
  } else if (msgType === "image") {
    mediaType = "image";
    mediaBase64 = msg.data || null;
    mediaUrl = msg.url || null;
    mensagem = msg.caption || "[Imagem]";
  } else if (msgType === "audio") {
    mediaType = "audio";
    mediaBase64 = msg.data || null;
    mediaUrl = msg.url || null;
    mensagem = "[Áudio]";
  } else if (msgType === "video") {
    mediaType = "video";
    mediaBase64 = msg.data || null;
    mediaUrl = msg.url || null;
    mensagem = msg.caption || "[Vídeo]";
  } else if (msgType === "sticker") {
    mediaType = "sticker";
    mediaBase64 = msg.data || null;
    mediaUrl = msg.url || null;
    mensagem = "[Sticker]";
  } else if (msgType === "document") {
    mediaType = "document";
    mediaBase64 = msg.data || null;
    mediaUrl = msg.url || null;
    fileName = msg.filename || msg.fileName || null;
    mensagem = msg.filename || msg.fileName || "[Documento]";
  } else if (msgType === "location") {
    mensagem = `[Localização] ${msg.latitude || ''}, ${msg.longitude || ''}`;
  } else if (msgType === "contact") {
    mensagem = `[Contato] ${msg.displayName || msg.vcard || ''}`;
  } else if (msgType === "reaction") {
    // Reações são ignoradas
    mensagem = null;
  } else {
    // Fallback: tentar extrair de outros formatos
    console.log("[Webhook WAHA] Tipo desconhecido:", msgType, "keys:", Object.keys(msg).join(", "));
    
    // Tentar body como texto
    if (msg.body) {
      mensagem = msg.body;
    }
  }

  // Se mensagem é null e tem mídia, usar tipo
  if (!mensagem && mediaType) {
    mensagem = `[${mediaType}]`;
  }

  return {
    chatId,
    telefone,
    nome,
    mensagem,
    mediaType,
    mediaUrl,
    mediaBase64,
    fileName,
    messageId,
    session,
    fromMe,
    messageTimestamp,
  };
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
 * Busca atendimento aberto existente para o telefone
 */
async function buscarAtendimentoAberto(telefoneLimpo: string, _sessionName: string | null) {
  // Primeiro: busca exata (rápida)
  const { data: exato } = await getSupabase()
    .from("atendimentos")
    .select("id, nome_cliente, cliente_id, vendedor_id, instance_name")
    .eq("telefone_cliente", telefoneLimpo)
    .eq("status", "aberto")
    .limit(1)
    .single();

  if (exato) return exato;

  // Segundo: busca ampla — compara apenas os últimos 8 dígitos (tolerante a formatos)
  const ultimos8 = telefoneLimpo.slice(-8);
  if (ultimos8.length < 8) return null;
  const { data: candidatos } = await getSupabase()
    .from("atendimentos")
    .select("id, nome_cliente, cliente_id, vendedor_id, telefone_cliente, instance_name")
    .eq("status", "aberto")
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
 * Envia mensagem de texto via WAHA
 */
async function wahaEnviarMensagem(sessionName: string, telefone: string, mensagem: string): Promise<boolean> {
  const apiUrl = process.env.WAHA_URL;
  if (!apiUrl) return false;

  try {
    const telefoneFormatado = telefone.startsWith("55") ? telefone : `55${telefone}`;
    const response = await fetch(`${apiUrl}/api/sendText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: `${telefoneFormatado}@c.us`,
        text: mensagem,
        session: sessionName,
      }),
    });
    return response.ok;
  } catch (err) {
    console.error("[WAHA Send] Erro:", err);
    return false;
  }
}

/**
 * Chama o AI Sales pra responder o cliente e possívelmente criar tarefa no kanban
 */
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * Chama Gemini direto (sem self-call HTTP) pra responder o cliente
 */
async function chamarAISales(telefone: string, sessionName: string | null) {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log(`[AI Sales] Iniciando para ${telefone}, session=${sessionName}, apiKey=${apiKey ? "PRESENTE" : "AUSENTE"}`);
  if (!apiKey) {
    console.log("[AI Sales] GEMINI_API_KEY não configurada, pulando");
    return;
  }

  // Verifica se o bot está ligado
  try {
    const { data: config } = await getSupabase()
      .from("ai_sales_config")
      .select("enabled")
      .limit(1)
      .single();

    if (config && !config.enabled) {
      console.log("[AI Sales] Bot DESLIGADO pelo gestor, pulando");
      return;
    }
  } catch (err) {
    // Se a tabela não existe, assume ligado
    console.log("[AI Sales] Config não encontrada, bot assume LIGADO");
  }

  try {
    // 1. Busca atendimento aberto
    console.log(`[AI Sales] Buscando atendimento para ${telefone}`);
    let query = getSupabase()
      .from("atendimentos")
      .select("id, nome_cliente")
      .eq("telefone_cliente", telefone)
      .eq("status", "aberto");

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
    if (sessionName) {
      const enviou = await wahaEnviarMensagem(sessionName, telefone, textoResposta);
      console.log(`[AI Sales] Resposta enviada para ${telefone}: ${enviou ? "OK" : "FALHOU"}`);

      // Salva a resposta da IA no banco pra aparecer no CRM
      await getSupabase().from("atendimento_mensagens").insert({
        atendimento_id: atendimento.id,
        remetente: "vendedor",
        conteudo: `[IA] ${textoResposta}`,
        enviada_por: null,
        tipo_midia: "texto",
        created_at: new Date().toISOString(),
      });

      // Atualiza última mensagem do atendimento
      await getSupabase()
        .from("atendimentos")
        .update({
          ultima_mensagem: `[IA] ${textoResposta}`,
          ultima_mensagem_data: new Date().toISOString(),
          ultima_mensagem_remetente: "vendedor",
          nao_lido: true,
        })
        .eq("id", atendimento.id);

      console.log(`[AI Sales] Resposta salva no atendimento ${atendimento.id}`);
    }

    // 5. Analisa se deve criar tarefa no kanban
    const oportunidade = await analisarOportunidadeIA(apiKey, nomeCliente, historico, textoResposta);
    if (oportunidade.criar && oportunidade.titulo) {
      await criarTarefaKanban({
        titulo: oportunidade.titulo,
        descricao: oportunidade.descricao || `Oportunidade para ${nomeCliente}`,
        prioridade: oportunidade.prioridade || "media",
        cliente_nome: nomeCliente,
      }, sessionName);
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
}, sessionName: string | null) {
  try {
    // Busca vendedor do atendimento mais recente desta sessão
    const { data: atendimento } = await getSupabase()
      .from("atendimentos")
      .select("vendedor_id")
      .eq("instance_name", sessionName)
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
