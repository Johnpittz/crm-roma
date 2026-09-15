/**
 * Debug endpoint: test Supabase Storage upload
 * GET /api/debug/storage-test
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const diagnostics: any = {
      hasUrl: !!url,
      hasKey: !!key,
      keyPrefix: key ? key.substring(0, 10) + "..." : "MISSING",
      urlValue: url || "MISSING",
    };

    if (!url || !key) {
      return NextResponse.json({ error: "Missing env vars", diagnostics }, { status: 500 });
    }

    const supabase = createClient(url, key);

    // List buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    diagnostics.buckets = buckets?.map((b: any) => b.id) || [];
    diagnostics.listError = listError?.message || null;

    // Try upload
    const testContent = "dGVzdA=="; // "test" in base64
    const buffer = Buffer.from(testContent, "base64");
    const testPath = `test/debug-${Date.now()}.txt`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("chat-media")
      .upload(testPath, buffer, {
        contentType: "text/plain",
        upsert: true,
      });

    diagnostics.uploadSuccess = !uploadError;
    diagnostics.uploadError = uploadError?.message || null;
    diagnostics.uploadPath = uploadData?.path || null;

    // Get public URL
    if (uploadData?.path) {
      const { data: urlData } = supabase.storage
        .from("chat-media")
        .getPublicUrl(uploadData.path);
      diagnostics.publicUrl = urlData?.publicUrl || null;
    }

    return NextResponse.json(diagnostics);
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack });
  }
}
