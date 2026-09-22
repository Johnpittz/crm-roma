/**
 * Rota para enviar mídia via WhatsApp
 * 
 * Endpoint: POST /api/send/media
 * Body: { number, mediatype, mimetype, media (base64), fileName?, instance?, provider?: "waha"|"evolution" }
 * 
 * Retorna: { success, message_id, media_url? }
 * media_url é a URL pública no Supabase Storage (para exibir no CRM)
 * 
 * Suporta dois providers:
 * - "waha" (padrão) - WhatsApp HTTP API
 * - "evolution" - Evolution API (fallback)
 */

import { NextRequest, NextResponse } from "next/server";
import { enviarMidiaWhatsApp as wahaEnviarMidia, enviarAudioWhatsApp as wahaEnviarAudio } from "@/lib/waha-api";
import { enviarMidiaWhatsApp as evoEnviarMidia, enviarAudioWhatsApp as evoEnviarAudio } from "@/lib/evolution-api";
import { uploadMediaToStorage } from "@/lib/media-storage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { number, mediatype, mimetype, media, fileName, instance, provider } = body;

    if (!number || !media) {
      return NextResponse.json(
        { error: "number e media são obrigatórios" },
        { status: 400 }
      );
    }

    // Determinar provider (padrão: waha)
    const useProvider = provider || "waha";
    
    console.log(`[Send Media] Enviando ${mediatype || 'image'} para ${number} via ${useProvider} (session: ${instance || 'padrão'})`);

    // Upload da mídia para Supabase Storage ANTES de enviar
    let mediaUrl: string | null = null;
    try {
      const prefix = mediatype === "audio" ? "audio"
        : mediatype === "video" ? "video"
        : mediatype === "sticker" ? "sticker"
        : mediatype === "document" ? "document"
        : "image";
      
      const mime = mimetype || (mediatype === "audio" ? "audio/ogg; codecs=opus" : "image/jpeg");
      mediaUrl = await uploadMediaToStorage(media, mime, prefix);
      
      if (mediaUrl) {
        console.log(`[Send Media] Mídia salva no Storage: ${mediaUrl}`);
      }
    } catch (err: any) {
      console.error("[Send Media] Erro ao salvar no Storage:", err.message);
      // Continua mesmo sem Storage - envio via WhatsApp é prioridade
    }

    // Selecionar funções do provider
    const enviarMidia = useProvider === "waha" ? wahaEnviarMidia : evoEnviarMidia;
    const enviarAudio = useProvider === "waha" ? wahaEnviarAudio : evoEnviarAudio;

    // Se for áudio, usar endpoint especial de áudio (ptt)
    if (mediatype === 'audio') {
      const result = await enviarAudio({
        telefone: number,
        audio: media,
        instance,
      });

      if (!result.success) {
        console.error("[Send Media] Erro áudio:", result.error);
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      console.log("[Send Media] Áudio enviado com sucesso");
      return NextResponse.json({
        success: true,
        message_id: result.message_id,
        media_url: mediaUrl,
      });
    }

    // Para outros tipos de mídia
    const result = await enviarMidia({
      telefone: number,
      mediatype: mediatype || 'image',
      mimetype: mimetype || 'image/jpeg',
      media,
      fileName,
      instance,
    });

    if (!result.success) {
      console.error("[Send Media] Erro:", result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    console.log("[Send Media] Enviado com sucesso");
    return NextResponse.json({
      success: true,
      message_id: result.message_id,
      media_url: mediaUrl,
    });
  } catch (error: any) {
    console.error("[Send Media] Erro geral:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao enviar mídia" },
      { status: 500 }
    );
  }
}
