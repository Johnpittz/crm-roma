import { NextRequest, NextResponse } from "next/server";
import { createClient, createClient as createServiceClient } from "@supabase/supabase-js";
import { escopoCarteira, aplicarEscopoClientes, idsDaEquipe } from "@/lib/carteira";
import { filtroBuscaClientes } from "@/lib/busca-clientes";
import { topClientes, idsReaisParaExcluir, TOP_CLIENTES_LIMITE } from "@/lib/top-clientes";
import {
  aplicarFiltroContato,
  situacoesDoEscopo,
  type FiltroContato,
} from "@/lib/situacao-contato";
import { normalizarNome } from "@/lib/nome-cliente";

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
    // REGRA do card de atendimento: o Top 20 (os que mais compraram) não pode
    // aparecer na listagem CLIENTES ao lado. O card pede com excluir_top20=1 e
    // o corte acontece AQUI, no servidor, para lista e contador saírem iguais.
    const excluirTop20 = ["1", "true", "sim"].includes(
      (searchParams.get("excluir_top20") || "").toLowerCase()
    );
    // Nome, CPF/CNPJ, telefone, celular ou e-mail (ver lib/busca-clientes.ts)
    const filtroBusca = filtroBuscaClientes(busca);

    // REGRA (bug de 01/10/2026): o ranking é calculado UMA vez — ele tira o
    // Top 20 da listagem E volta em `top` para o card. Antes o card pedia em
    // outra chamada e o cache de 5 s podia estar desatualizado: o cliente saía
    // da lista (corte novo) mas não aparecia no card (ranking velho) — sumia
    // dos DOIS lados. Com uma resposta só, card e exclusão nunca divergem.
    const ranking = excluirTop20
      ? await topClientes(supabase, {
          escopo,
          userId: userData.user.id,
          equipeIds: equipe,
          limite: TOP_CLIENTES_LIMITE,
        })
      : [];
    const idsExcluidos = idsReaisParaExcluir(ranking);
    const semTop20 = (q: any) =>
      idsExcluidos.length ? q.not("id", "in", `(${idsExcluidos.join(",")})`) : q;

    // ── CONTATO (card de atendimento) ────────────────────────────────────
    // REGRA 30/09/2026: quem tem tarefa aberta "desce para o fim" (para o
    // vendedor não se perder); passou de 24h sem resposta ou com prazo
    // vencido -> ATRASADO (vermelho, topo); tarefa concluída -> REALIZADO
    // (verde, fim). Detalhes e testes: lib/situacao-contato.ts.
    // A página /clientes não manda `contato=`, então continua exatamente igual.
    const filtroContato = (searchParams.get("contato") || "").toLowerCase();
    const comContato = ["todos", "atrasados", "realizados"].includes(filtroContato);

    if (comContato) {
      // 1) ids + nomes de TODO o escopo (o PostgREST não ordena por tarefa,
      //    então a prioridade é montada aqui em memória — linhas leves).
      const base: { id: string; nome_razao_social: string }[] = [];
      const PAGINA = 1000;
      let erroBase: string | null = null;

      while (base.length < 20_000) {
        let q = supabase.from("clientes").select("id, nome_razao_social");
        if (filtroBusca) q = q.or(filtroBusca);
        if (status) q = q.eq("status", status);
        const offset = base.length;
        const { data, error } = await semTop20(
          aplicarEscopoClientes(q, escopo, userData.user.id, equipe)
        )
          .order("nome_razao_social", { ascending: true })
          .range(offset, offset + PAGINA - 1);

        if (error) {
          erroBase = error.message;
          break;
        }
        base.push(...(data || []));
        if ((data || []).length < PAGINA) break;
      }

      if (erroBase) {
        return NextResponse.json({ error: erroBase }, { status: 500 });
      }

      // 2) situação de contato por cliente (mesma carteira da listagem)
      const porNome = new Map(
        base.map((c) => [normalizarNome(c.nome_razao_social), c.id] as const)
      );
      const situacoes = await situacoesDoEscopo(supabase, {
        escopo,
        userId: userData.user.id,
        equipeIds: equipe,
        porNome,
      });

      // 3) ordem de prioridade + filtro + contagem dos grupos
      const { ids, contagem } = aplicarFiltroContato(
        base.map((c) => c.id),
        (id) => situacoes.get(id),
        filtroContato as FiltroContato
      );
      const pagina = ids.slice(0, limite);

      // 4) linhas completas do recorte (lotes de 100: a URL não pode estourar)
      const porId = new Map<string, any>();
      for (let i = 0; i < pagina.length; i += 100) {
        const { data: linhas, error: erroLote } = await supabase
          .from("clientes")
          .select(COLUNAS_LISTA)
          .in("id", pagina.slice(i, i + 100));
        if (erroLote) {
          return NextResponse.json({ error: erroLote.message }, { status: 500 });
        }
        for (const linha of linhas || []) porId.set(linha.id, linha);
      }

      const clientes = pagina
        .map((id) => porId.get(id))
        .filter(Boolean)
        .map((c: any) => ({ ...c, contato: situacoes.get(c.id) ?? "sem_tarefa" }));

      return NextResponse.json({
        clientes,
        // total = do grupo filtrado (o badge do card mostra este)
        total: ids.length,
        escopo,
        limite,
        excluidos_top20: idsExcluidos.length,
        // o mesmo ranking que gerou o corte — o card renderiza daqui
        top: ranking,
        contato: filtroContato,
        contatos: contagem,
      });
    }

    // Total do escopo (independente do limite) — alimenta contadores e métricas
    let countQuery = supabase.from("clientes").select("id", { count: "exact", head: true });
    if (filtroBusca) countQuery = countQuery.or(filtroBusca);
    if (status) countQuery = countQuery.eq("status", status);
    const { count, error: countError } = await semTop20(
      aplicarEscopoClientes(
        countQuery,
        escopo,
        userData.user.id,
        equipe
      )
    );

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    // Lista do escopo (com limite — o card do atendimento não carrega 3 mil linhas)
    let listQuery = supabase.from("clientes").select(COLUNAS_LISTA);
    if (filtroBusca) listQuery = listQuery.or(filtroBusca);
    if (status) listQuery = listQuery.eq("status", status);
    const { data: clientes, error } = await semTop20(
      aplicarEscopoClientes(
        listQuery,
        escopo,
        userData.user.id,
        equipe
      )
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
      // Quantos do Top 20 saíram desta listagem (0 quando não pediu o corte)
      excluidos_top20: idsExcluidos.length,
      // o mesmo ranking que gerou o corte — o card renderiza daqui
      top: ranking,
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
