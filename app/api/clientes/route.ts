import { NextRequest, NextResponse } from "next/server";
import { createClient, createClient as createServiceClient } from "@supabase/supabase-js";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const supabase = createServiceClient(SUPABASE_URL, SERVICE_KEY);
    const { data: clientes, error } = await supabase
      .from("clientes")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ clientes: [], total: clientes?.length || 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // Cria client com o token do usuário logado — RLS é respeitado automaticamente
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Pega o usuário autenticado
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    // Verifica se é demonstração (demo não pode criar clientes reais)
    const { data: profile } = await supabase
      .from("profiles")
      .select("cargo")
      .eq("id", userData.user.id)
      .single();
    
    if ((profile?.cargo || "") === "demonstracao") {
      return NextResponse.json({ 
        error: "Usuários de demonstração não podem cadastrar clientes" 
      }, { status: 403 });
    }

    const { error } = await supabase.from("clientes").insert({
      nome_razao_social: body.nome_razao_social,
      cpf_cnpj: body.cpf_cnpj || null,
      telefone: body.telefone || null,
      email: body.email || null,
      cidade: body.cidade || null,
      estado: body.estado || null,
      status: body.status,
      tipo: body.tipo,
      vendedor_responsavel_id: userData.user.id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
