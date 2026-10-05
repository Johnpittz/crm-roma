/**
 * REGRA (01/10/2026): todo documento (planilha, PDF, DOC…) do chat precisa ter
 * link de download — inclusive os antigos, gravados SEM `url_midia`.
 *
 * Motivo: o bucket `chat-media` só aceitava imagem/áudio/vídeo/PDF/DOC, então o
 * upload das planilhas falhava e a mensagem ficava só com o nome do arquivo
 * (print do João: "não consigo baixar").
 *
 * Helper puro testado aqui e usado pelo `chat-inline` na renderização.
 */
import { describe, it, expect } from "vitest";
import { urlMidiaDaMensagem } from "./midia-chat";

const DOC = { id: "e5265b93-1528-4d4b-9b53-f091eb345269", tipo_midia: "documento" };

describe("urlMidiaDaMensagem — documento do WhatsApp", () => {
  it("documento SEM url_midia vira link de download pelo msg_id", () => {
    const url = urlMidiaDaMensagem({ ...DOC, url_midia: null });
    expect(url).toBe(`/api/media-download?msg_id=${DOC.id}&type=document`);
  });

  it("documento sem url e SEM id não vira link (nada para buscar)", () => {
    expect(urlMidiaDaMensagem({ id: undefined, tipo_midia: "documento" })).toBeNull();
    expect(urlMidiaDaMensagem({ id: "virtual-1", tipo_midia: "documento" })).toBeNull();
  });

  it("documento já salvo no Storage também baixa pelo proxy (aba visível + nome original)", () => {
    // com link direto ao Storage o `download` é ignorado (cross-origin) e o
    // clique no proxy era silencioso: o João clicava e "não acontecia nada".
    const url = urlMidiaDaMensagem({ ...DOC, url_midia: "https://x.supabase.co/storage/v1/object/public/chat-media/whatsapp/a.xlsx" });
    expect(url).toBe(`/api/media-download?msg_id=${DOC.id}&type=document`);
  });

  it("documento SEM id usável mantém a URL direta (não há msg_id para buscar)", () => {
    const url = urlMidiaDaMensagem({ id: "virtual-1", tipo_midia: "documento", url_midia: "https://x.supabase.co/storage/v1/object/public/chat-media/whatsapp/a.xlsx" });
    expect(url).toBe("https://x.supabase.co/storage/v1/object/public/chat-media/whatsapp/a.xlsx");
  });

  it("documento no CDN do WhatsApp também passa pelo proxy", () => {
    const url = urlMidiaDaMensagem({ ...DOC, url_midia: "https://mmg.whatsapp.net/v/t62.7114-24/abc.enc" });
    expect(url).toBe(`/api/media-download?msg_id=${DOC.id}&type=document`);
  });

  it("QUALQUER mídia sem url_midia passa a ter link pelo msg_id (print 02/10: vídeo não reproduzia)", () => {
    const id = "0dedea07-8016-4687-81fe-0b6c229a602b";
    for (const [tipo, esperado] of [
      ["video", "video"],
      ["vídeo", "video"],
      ["audio", "audio"],
      ["imagem", "image"],
      ["documento", "document"],
    ] as const) {
      expect(urlMidiaDaMensagem({ id, tipo_midia: tipo, url_midia: null })).toBe(
        `/api/media-download?msg_id=${id}&type=${esperado}`
      );
    }
  });

  it("texto (sem tipo de mídia) continua sem link — não manda texto pro proxy", () => {
    expect(urlMidiaDaMensagem({ id: "abc", url_midia: null })).toBeNull();
    expect(urlMidiaDaMensagem({ id: "abc", tipo_midia: null, url_midia: null })).toBeNull();
  });

  it("vídeo sem url e SEM id utilizável não vira link", () => {
    expect(urlMidiaDaMensagem({ id: "virtual-9", tipo_midia: "video", url_midia: null })).toBeNull();
    expect(urlMidiaDaMensagem({ id: undefined, tipo_midia: "video", url_midia: null })).toBeNull();
  });

  it("vídeo já salvo no Storage usa a própria URL", () => {
    expect(
      urlMidiaDaMensagem({ id: "x", tipo_midia: "video", url_midia: "https://x.supabase.co/storage/v1/object/public/chat-media/whatsapp/a.mp4" })
    ).toBe("https://x.supabase.co/storage/v1/object/public/chat-media/whatsapp/a.mp4");
  });

  it("imagem com url de Storage usa a própria URL (comportamento antigo)", () => {
    const url = urlMidiaDaMensagem({ id: "x", tipo_midia: "imagem", url_midia: "https://x.supabase.co/storage/v1/object/public/chat-media/a.jpg" });
    expect(url).toBe("https://x.supabase.co/storage/v1/object/public/chat-media/a.jpg");
  });

  it("mídia com URL externa passa pelo proxy /api/media (comportamento antigo)", () => {
    const url = urlMidiaDaMensagem({ id: "x", tipo_midia: "audio", url_midia: "https://exemplo.com/a.ogg" });
    expect(url).toBe(`/api/media?url=${encodeURIComponent("https://exemplo.com/a.ogg")}&type=audio`);
  });
});
