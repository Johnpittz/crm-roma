import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolverUrlMidia, getWahaConfig } from "@/lib/waha";
import { uploadMediaToStorage } from "@/lib/media-storage";

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

// Evolution API config — LEGADO: decrypt de mídias antigas (mmg.whatsapp.net).
// Mídias novas chegam prontas via WAHA (media.url) e são salvas no Supabase Storage
// pelo webhook (docs/plano-implementacao-waha.md Fase 5).
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8082";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";

// Simple in-memory cache for decoded media (TTL: 1 hour)
const mediaCache = new Map<string, { data: ArrayBuffer; contentType: string; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
// Só mídia pequena entra na memória: vídeo de 10 MB estouraria o pod
// (o player recebe redirect pro Storage, não precisa de cache aqui).
const CACHE_MAX_BYTES = 2_000_000;

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
    const oldest = Array.from(mediaCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) mediaCache.delete(oldest[0]);
  }
}

/** ContentType quando o WAHA não devolve (fallback pelo ?type=). */
function contentTypePorPadrao(type: string): string {
  switch (type) {
    case "image": return "image/jpeg";
    case "audio": return "audio/ogg";
    case "video": return "video/mp4";
    case "document": return "application/octet-stream";
    default: return "application/octet-stream";
  }
}

/** Só imagem/áudio/vídeo ficam inline; o resto (planilha, PDF…) baixa como anexo. */
function ehDocumento(contentType: string): boolean {
  return !/^(image|audio|video)\//i.test(contentType);
}

/** Cabeçalhos de um arquivo servido — anexo com o NOME ORIGINAL quando é documento. */
function headersArquivo(file_name: unknown, contentType: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=3600",
  };
  if (file_name && ehDocumento(contentType)) {
    const nome = String(file_name).replace(/[\r\n\"]/g, "");
    headers["Content-Disposition"] = `attachment; filename="${nome}"`;
  }
  return headers;
}

/**
 * Auto-cura: depois de servir um arquivo que estava só no WAHA, guarda no
 * Storage e grava `url_midia` — os próximos downloads vão direto, sem
 * varrer o histórico do chat de novo. Qualquer falha aqui é irrelevante:
 * o arquivo já foi entregue.
 */
async function guardarNoStorage(mensagem: any, buffer: ArrayBuffer, contentType: string): Promise<string | null> {
  try {
    const base64 = Buffer.from(buffer).toString("base64");
    const url = await uploadMediaToStorage(base64, contentType, "whatsapp");
    if (!url) return null;
    await getSupabase()
      .from("atendimento_mensagens")
      .update({ url_midia: url })
      .eq("id", mensagem.id);
    return url;
  } catch (err: any) {
    console.error("[MediaDownload] Auto-cura falhou (o arquivo já foi servido):", err?.message || err);
    return null;
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
    .select("id, atendimento_id, whatsapp_message_id, tipo_midia, url_midia, file_name")
    .eq("whatsapp_message_id", msgId)
    .limit(1)
    .maybeSingle();

  if (byWppId) {
    mensagem = byWppId;
  } else {
    // Try by message UUID
    const { data: byUuid } = await supabase
      .from("atendimento_mensagens")
      .select("id, atendimento_id, whatsapp_message_id, tipo_midia, url_midia, file_name")
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
  // — EXCETO documento: o nome no Storage é `<data>-<rand>.<ext>` e o download
  // sairia com o nome errado (ex.: `.docx` no lugar da planilha original).
  if (mensagem.url_midia && !mensagem.url_midia.includes("mmg.whatsapp.net")) {
    if (type === "document") {
      try {
        const resp = await fetch(mensagem.url_midia);
        if (resp.ok) {
          const buffer = await resp.arrayBuffer();
          const contentType = resp.headers.get("content-type") || "application/octet-stream";
          return new Response(buffer, {
            status: 200,
            headers: headersArquivo(mensagem.file_name, contentType),
          });
        }
        console.error(`[MediaDownload] Storage não entregou o documento: HTTP ${resp.status}`);
      } catch (err: any) {
        console.error("[MediaDownload] Erro ao baixar documento do Storage:", err?.message || err);
      }
    }
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

  // ── WAHA (instância atual): resolve a URL real da mídia e devolve os bytes.
  // É o caminho dos DOCUMENTOS sem url_midia (planilhas antigas: o bucket só
  // aceitava imagem/áudio/vídeo/PDF/DOC e o upload delas falhava).
  try {
    const urlWaha = await resolverUrlMidia({
      urlMidia: null,
      telefone: atendimento.telefone_cliente,
      messageId: whatsappMsgId,
      session: instanceName,
    });

    if (urlWaha) {
      const resposta = await fetch(urlWaha, { headers: { "X-Api-Key": getWahaConfig().apiKey } });
      if (resposta.ok) {
        const buffer = await resposta.arrayBuffer();
        const contentType = resposta.headers.get("content-type") || contentTypePorPadrao(type);
        const urlSalva = await guardarNoStorage(mensagem, buffer, contentType);

        // Vídeo/áudio/imagem curado → REDIRECIONA: o Storage serve com Range
        // (o player precisa disso) e a Vercel não passa 10 MB pela função.
        if (urlSalva && !ehDocumento(contentType)) {
          console.log(`[MediaDownload] Mídia curada e redirecionada: ${whatsappMsgId}`);
          return NextResponse.redirect(urlSalva);
        }

        if (buffer.byteLength <= CACHE_MAX_BYTES) setCachedMedia(cacheKey, buffer, contentType);

        console.log(`[MediaDownload] Mídia servida via WAHA: ${whatsappMsgId}`);
        return new Response(buffer, {
          status: 200,
          headers: headersArquivo(mensagem.file_name, contentType),
        });
      }
      console.error(`[MediaDownload] WAHA devolveu HTTP ${resposta.status} para ${whatsappMsgId}`);
    }
  } catch (err: any) {
    console.error("[MediaDownload] Erro ao resolver mídia no WAHA:", err?.message || err);
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

    // Parse the base64 data URI: "data:audio/ogg;base64,AAAA..." or raw base64
    const base64String: string = evoData.base64;
    const commaIndex = base64String.indexOf(",");
    
    let rawBase64: string;
    let contentType: string;
    
    if (commaIndex !== -1) {
      // Format: "data:audio/ogg;base64,AAAA..."
      const dataUri = base64String.substring(0, commaIndex);
      rawBase64 = base64String.substring(commaIndex + 1);
      const contentTypeMatch = dataUri.match(/^data:([^;]+)/);
      contentType = contentTypeMatch ? contentTypeMatch[1] : "application/octet-stream";
    } else {
      // Raw base64 without data: prefix (common in Evolution API)
      rawBase64 = base64String;
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
