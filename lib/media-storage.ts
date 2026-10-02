/**
 * Upload base64 media to Supabase Storage and return public URL.
 * Prevents egress bloat by storing files in Storage instead of database.
 */

import { createClient } from "@supabase/supabase-js";

let supabaseStorage: any = null;
function getStorageClient() {
  if (!supabaseStorage) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase credentials missing");
    supabaseStorage = createClient(url, key);
  }
  return supabaseStorage;
}

/**
 * Uploads a base64 data string to Supabase Storage bucket "media".
 * @param base64Data - Raw base64 string (without data: prefix)
 * @param mimeType - MIME type (e.g. "audio/ogg; codecs=opus")
 * @param prefix - Folder prefix (e.g. "audio", "image", "video")
 * @returns Public URL or null on failure
 */
export async function uploadMediaToStorage(
  base64Data: string,
  mimeType: string,
  prefix: string
): Promise<string | null> {
  try {
    // Normalize MIME type — bucket allowed_mime_types uses base types only
    // e.g. "audio/ogg; codecs=opus" → "audio/ogg"
    const normalizedMime = mimeType.split(";")[0].trim();

    const buffer = Buffer.from(base64Data, "base64");

    // Determine extension from MIME type
    const ext = getExtensionFromMime(mimeType);
    const filename = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const storage = getStorageClient();

    const { data, error } = await storage.storage
      .from("chat-media")
      .upload(filename, buffer, {
        contentType: normalizedMime,
        upsert: false,
      });

    if (error) {
      console.error("[MediaStorage] Upload error:", error.message);
      return null;
    }

    // Get public URL
    const { data: urlData } = storage.storage
      .from("chat-media")
      .getPublicUrl(data.path);

    console.log("[MediaStorage] Uploaded:", filename, "->", urlData.publicUrl);
    return urlData.publicUrl;
  } catch (err: any) {
    console.error("[MediaStorage] Error:", err.message);
    return null;
  }
}

/**
 * Extensão do arquivo salvo no Storage a partir do MIME.
 * ORDEM IMPORTA: o mime do `.xlsx` é
 * `…officedocument.spreadsheetml.sheet` e contém "document" — a regra de
 * planilha precisa vir ANTES da genérica de documento, senão o `.xlsx` é
 * gravado como `.docx` (bug achado na auto-cura do download do chat).
 */
export function getExtensionFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("ogg")) return "ogg";
  if (m.includes("opus")) return "ogg";
  if (m.includes("mp3") || m.includes("mpeg")) return "mp3";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("webm")) return "webm";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("pdf")) return "pdf";
  // planilhas (antes da regra genérica de "document")
  if (m.includes("spreadsheet") || m.includes("excel")) {
    if (m.includes("ms-excel")) return "xls";
    if (m.includes("opendocument")) return "ods";
    return "xlsx";
  }
  // apresentações
  if (m.includes("presentation") || m.includes("powerpoint")) {
    if (m.includes("ms-powerpoint")) return "ppt";
    if (m.includes("opendocument")) return "odp";
    return "pptx";
  }
  // texto simples, planilha em CSV e comprimidos
  if (m.includes("csv")) return "csv";
  if (m.includes("text/plain")) return "txt";
  if (m.includes("zip")) return "zip";
  if (m.includes("x-rar") || m.includes("vnd.rar")) return "rar";
  if (m.includes("x-7z") || m.includes("7-zip")) return "7z";
  // documentos de texto
  if (m.includes("wordprocessing")) return "docx";
  if (m.includes("msword")) return "doc";
  if (m.includes("document")) return "docx";
  return "bin";
}
