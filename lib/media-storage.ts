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
    const buffer = Buffer.from(base64Data, "base64");

    // Determine extension from MIME type
    const ext = getExtensionFromMime(mimeType);
    const filename = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const storage = getStorageClient();

    const { data, error } = await storage.storage
      .from("chat-media")
      .upload(filename, buffer, {
        contentType: mimeType,
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

function getExtensionFromMime(mime: string): string {
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
  if (m.includes("document") || m.includes("msword")) return "docx";
  if (m.includes("spreadsheet") || m.includes("excel")) return "xlsx";
  return "bin";
}
