import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { escopoCarteira, idsDaEquipe } from "@/lib/carteira";
import { TOP_CLIENTES_LIMITE, topClientes } from "@/lib/top-clientes";

export const dynamic = "force-dynamic";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

// GET /api/clientes/top?limite=20
// TOP 20 CLIENTES (os que mais compraram) — ranking por valor total comprado
// dentro do escopo de carteira de quem olha. É a mesma lista que some da
// listagem CLIENTES (GET /api/clientes?excluir_top20=1).
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const supabase = createServiceClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const { data: perfil } = await supabase
      .from("profiles")
      .select("cargo")
      .eq("id", userData.user.id)
      .single();

    const escopo = escopoCarteira(perfil?.cargo);
    const equipe = escopo === "equipe" ? await idsDaEquipe(supabase, userData.user.id) : [];

    const { searchParams } = new URL(request.url);
    const limite = Math.min(
      Math.max(parseInt(searchParams.get("limite") || String(TOP_CLIENTES_LIMITE), 10) || TOP_CLIENTES_LIMITE, 1),
      100
    );

    const ranking = await topClientes(supabase, {
      escopo,
      userId: userData.user.id,
      equipeIds: equipe,
      limite,
    });

    return NextResponse.json({ clientes: ranking, limite, escopo });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
