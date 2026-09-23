import { NextRequest, NextResponse } from "next/server";
import { createClient, createClient as createServiceClient } from "@supabase/supabase-js";
import { escopoCarteira, aplicarEscopoClientes, idsDaEquipe } from "@/lib/carteira";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const COLUNAS_LISTA =
  "id, nome_razao_social, cpf_cnpj, telefone, celular, email, cidade, estado, status, tipo";

// GET /api/clientes[?limite=200&busca=&status=]
// REGRA: vendedor só vê a própria carteira; gestor vê a carteira toda (visão provisória).
// O escopo é decidido AQUI, no servidor, pelo cargo — nunca vem do cliente.
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
    // Gestor: resolve a equipe (a carteira é dividida entre os gestores)
    const equipe = escopo === "equipe" ? await idsDaEquipe(supabase, userData.user.id) : [];

    const { searchParams } = new URL(request.url);
    const limite = Math.min(
      Math.max(parseInt(searchParams.get("limite") || "200", 10) || 200, 1),
      1000
    );
    const busca = searchParams.get("busca") || "";
    const status = searchParams.get("status") || "";

    // Total do escopo (independente do limite) — alimenta contadores e métricas
    let countQuery = supabase.from("clientes").select("id", { count: "exact", head: true });
    if (busca) countQuery = countQuery.ilike("nome_razao_social", `%${busca}%`);
    if (status) countQuery = countQuery.eq("status", status);
    const { count, error: countError } = await aplicarEscopoClientes(
      countQuery,
      escopo,
      userData.user.id,
      equipe
    );

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    // Lista do escopo (com limite — o card do atendimento não carrega 3 mil linhas)
    let listQuery = supabase.from("clientes").select(COLUNAS_LISTA);
    if (busca) listQuery = listQuery.ilike("nome_razao_social", `%${busca}%`);
    if (status) listQuery = listQuery.eq("status", status);
    const { data: clientes, error } = await aplicarEscopoClientes(
      listQuery,
      escopo,
      userData.user.id,
      equipe
    )
      .order("nome_razao_social", { ascending: true })
      .limit(limite);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      clientes: clientes || [],
      total: count ?? 0,
      escopo,
      limite,
    });
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
