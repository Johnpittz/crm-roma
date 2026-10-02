/**
 * Regras de URL de mídia do chat (Atendimento) — função pura, testada à parte,
 * usada pelo `chat-inline` na renderização das mensagens.
 *
 * Regra nova (01/10/2026): DOCUMENTO sem `url_midia` também vira link de
 * download. O bucket `chat-media` só aceitava imagem/áudio/vídeo/PDF/DOC, então
 * o upload das planilhas (.xlsx/.xls/.csv) falhava e a mensagem ficava só com o
 * nome do arquivo — o print do João ("não consigo baixar"). Agora o link aponta
 * para `/api/media-download`, que resolve o arquivo no WAHA e — auto-cura — o
 * grava no Storage.
 */

export interface MensagemMidia {
  id?: string | null;
  url_midia?: string | null;
  media_url?: string | null;
  tipo_midia?: string | null;
  media_type?: string | null;
}

/**
 * No banco o tipo vem em português ('imagem', 'documento'); o chat fala
 * 'image', 'document'… O que não for mapeado passa adiante ('texto', 'video'…).
 */
export function normalizarTipoMidia(tipo: string | null | undefined): string {
  if (!tipo) return "unknown";
  const map: Record<string, string> = {
    imagem: "image",
    áudio: "audio",
    audio: "audio",
    vídeo: "video",
    video: "video",
    documento: "document",
    document: "document",
    figurinha: "sticker",
    sticker: "sticker",
  };
  return map[tipo.toLowerCase()] || tipo;
}

/** true quando a mensagem tem id de verdade (as otimistas usam "virtual-"). */
export function idMensagemUsavel(id: string | null | undefined): boolean {
  return !!id && !id.startsWith("virtual-");
}

/**
 * URL que o chat deve usar para mostrar/baixar a mídia da mensagem:
 * - arquivo já no Storage/data URL → a própria URL;
 * - CDN do WhatsApp ou SEM URL → proxy `/api/media-download` (busca no WAHA);
 * - URL externa qualquer → proxy `/api/media`.
 * null = não há como mostrar (a UI mostra o estado vazio, nunca dado inventado).
 */
export function urlMidiaDaMensagem(msg: MensagemMidia): string | null {
  const url = msg.url_midia || msg.media_url || null;
  const tipo = normalizarTipoMidia(msg.tipo_midia || msg.media_type);
  const idUsavel = idMensagemUsavel(msg.id);

  if (url) {
    if (url.includes("mmg.whatsapp.net") && idUsavel) {
      return `/api/media-download?msg_id=${encodeURIComponent(msg.id!)}&type=${tipo}`;
    }
    if (url.startsWith("data:") || url.includes("supabase.co/storage")) return url;
    return `/api/media?url=${encodeURIComponent(url)}&type=${tipo}`;
  }

  // Documento sem URL (planilhas antigas): baixa pelo id da mensagem.
  if (tipo === "document" && idUsavel) {
    return `/api/media-download?msg_id=${encodeURIComponent(msg.id!)}&type=document`;
  }

  return null;
}
