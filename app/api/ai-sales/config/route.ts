import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai-sales/config - Retorna status do bot (enabled/disabled)
 * PATCH /api/ai-sales/config - Liga/desliga o bot (só gestores)
 */

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("ai_sales_config")
    .select("id, enabled, updated_at")
    .limit(1)
    .single();

  if (error) {
    // Se a tabela não existe, retorna enabled=true por padrão
    return NextResponse.json({ enabled: true });
  }

  return NextResponse.json({ enabled: data?.enabled ?? true });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Verifica se é gestor
  const { data: profile } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("id", user.id)
    .single();

  const isGestor = ["diretor", "admin", "gerente_comercial"].includes(profile?.cargo || "");
  if (!isGestor) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const { enabled } = body;

  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled deve ser boolean" }, { status: 400 });
  }

  // Busca registro existente
  const { data: config } = await supabase
    .from("ai_sales_config")
    .select("id")
    .limit(1)
    .single();

  if (config) {
    // Atualiza
    await supabase
      .from("ai_sales_config")
      .update({ enabled, updated_at: new Date().toISOString(), updated_by: user.id })
      .eq("id", config.id);
  } else {
    // Cria
    await supabase
      .from("ai_sales_config")
      .insert({ enabled, updated_by: user.id });
  }

  console.log(`[AI Sales] Bot ${enabled ? "LIGADO" : "DESLIGADO"} por ${user.id}`);

  return NextResponse.json({ enabled });
}
