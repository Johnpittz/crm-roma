import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Supabase admin client (service_role)
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

// Evolution API config
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8082";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "e3186c32139f79c7566a1d6a3f5bc702fae199c725a313ce9b7f8ff035123b01";

// Simple in-memory cache for decoded media (TTL: 1 hour)
const mediaCache = new Map<string, { data: ArrayBuffer; contentType: string; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCachedMedia(key: string): { data: ArrayBuffer; contentType: string } | null {
  const entry = mediaCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return { data: entry.data, contentType: entry.contentType };
  }
  if (entry) mediaCache.delete(key);
  return null;
}

function setCachedMedia(key: string, data: ArrayBuffer, contentType: string) {
  mediaCache.set(key, { data, contentType, timestamp: Date.now() });
  // Evict old entries if cache grows too large (max 100 entries)
  if (mediaCache.size > 100) {
    const oldest = [...mediaCache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) mediaCache.delete(oldest[0]);
  }
}

/**
 * GET /api/media-download?msg_id=xxx&type=audio
 * 
 * Decrypts and returns WhatsApp CDN media via Evolution API.
 * 
 * Params:
 *   - msg_id: whatsapp_message_id or the message UUID (from atendimento_mensagens)
 *   - type: media type hint (audio|image|video) - used for Content-Type fallback
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const msgId = searchParams.get("msg_id");
  const type = searchParams.get("type") || "audio";

  if (!msgId) {
    return NextResponse.json({ error: "msg_id é obrigatório" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Try to find the message by whatsapp_message_id first, then by id
  let mensagem: any = null;
  let atendimento: any = null;

  // Try by whatsapp_message_id
  const { data: byWppId } = await supabase
    .from("atendimento_mensagens")
    .select("id, atendimento_id, whatsapp_message_id, tipo_midia, url_midia")
    .eq("whatsapp_message_id", msgId)
    .limit(1)
    .maybeSingle();

  if (byWppId) {
    mensagem = byWppId;
  } else {
    // Try by message UUID
    const { data: byUuid } = await supabase
      .from("atendimento_mensagens")
      .select("id, atendimento_id, whatsapp_message_id, tipo_midia, url_midia")
      .eq("id", msgId)
      .limit(1)
      .maybeSingle();
    mensagem = byUuid;
  }

  if (!mensagem) {
    console.error(`[MediaDownload] Mensagem não encontrada: ${msgId}`);
    return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 });
  }

  // If the message already has a stored URL (not encrypted CDN), just redirect
  if (mensagem.url_midia && !mensagem.url_midia.includes("mmg.whatsapp.net")) {
    return NextResponse.redirect(mensagem.url_midia);
  }

  // Get the atendimento to find telefone_cliente and instance_name
  const { data: atendData } = await supabase
    .from("atendimentos")
    .select("telefone_cliente, instance_name")
    .eq("id", mensagem.atendimento_id)
    .limit(1)
    .maybeSingle();

  atendimento = atendData;

  if (!atendimento?.telefone_cliente) {
    console.error(`[MediaDownload] Atendimento sem telefone: ${mensagem.atendimento_id}`);
    return NextResponse.json({ error: "Atendimento sem telefone" }, { status: 404 });
  }

  const remoteJid = `${atendimento.telefone_cliente}@s.whatsapp.net`;
  const instanceName = atendimento.instance_name || "ROMA_1";
  const whatsappMsgId = mensagem.whatsapp_message_id;

  if (!whatsappMsgId) {
    console.error(`[MediaDownload] Mensagem sem whatsapp_message_id: ${mensagem.id}`);
    return NextResponse.json({ error: "Mensagem sem ID do WhatsApp" }, { status: 404 });
  }

  // Check cache
  const cacheKey = `media:${whatsappMsgId}:${type}`;
  const cached = getCachedMedia(cacheKey);
  if (cached) {
    console.log(`[MediaDownload] Cache hit: ${whatsappMsgId}`);
    return new Response(cached.data, {
      status: 200,
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // Call Evolution API to get base64 from media message
  const apiUrl = `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${instanceName}`;

  try {
    console.log(`[MediaDownload] Buscando mídia via Evolution API: ${whatsappMsgId} (instance: ${instanceName})`);

    const evoResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "apikey": EVOLUTION_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          key: {
            id: whatsappMsgId,
            remoteJid: remoteJid,
            fromMe: false,
          },
        },
      }),
    });

    if (!evoResponse.ok) {
      const errorText = await evoResponse.text();
      console.error(`[MediaDownload] Evolution API error ${evoResponse.status}:`, errorText);
      return NextResponse.json(
        { error: "Falha ao buscar mídia do WhatsApp", details: errorText },
        { status: 502 }
      );
    }

    const evoData = await evoResponse.json();

    if (!evoData.base64) {
      console.error(`[MediaDownload] Resposta sem base64:`, JSON.stringify(evoData).substring(0, 500));
      return NextResponse.json(
        { error: "Resposta da Evolution API não contém base64" },
        { status: 404 }
      );
    }

    // Parse the base64 data URI: "data:audio/ogg;base64,AAAA..."
    const base64String: string = evoData.base64;
    const commaIndex = base64String.indexOf(",");
    if (commaIndex === -1) {
      console.error(`[MediaDownload] Formato base64 inválido`);
      return NextResponse.json({ error: "Formato base64 inválido" }, { status: 500 });
    }

    const dataUri = base64String.substring(0, commaIndex);
    const rawBase64 = base64String.substring(commaIndex + 1);

    // Extract content type from data URI: "data:audio/ogg;base64" -> "audio/ogg"
    let contentType = "application/octet-stream";
    const contentTypeMatch = dataUri.match(/^data:([^;]+)/);
    if (contentTypeMatch) {
      contentType = contentTypeMatch[1];
    } else {
      // Fallback by type param
      const typeMap: Record<string, string> = {
        audio: "audio/ogg",
        image: "image/jpeg",
        video: "video/mp4",
      };
      contentType = typeMap[type] || "application/octet-stream";
    }

    // Decode base64 to ArrayBuffer
    const binaryString = atob(rawBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const arrayBuffer = bytes.buffer;

    // Cache the result
    setCachedMedia(cacheKey, arrayBuffer, contentType);

    console.log(`[MediaDownload] Sucesso: ${whatsappMsgId} (${contentType}, ${arrayBuffer.byteLength} bytes)`);

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Content-Length": String(arrayBuffer.byteLength),
      },
    });
  } catch (err: any) {
    console.error(`[MediaDownload] Erro ao buscar mídia:`, err.message || err);
    return NextResponse.json(
      { error: "Erro ao processar mídia", details: err.message },
      { status: 500 }
    );
  }
}
