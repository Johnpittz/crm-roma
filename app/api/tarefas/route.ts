import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/tarefas?data=YYYY-MM-DD - lista tarefas do vendedor logado
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const data = searchParams.get("data");
  const coluna = searchParams.get("coluna");
  const clienteNome = searchParams.get("cliente_nome");

  let query = supabase
    .from("tarefas")
    .select("*, clientes(id, nome_razao_social, telefone, celular)")
    .eq("vendedor_id", user.id)
    .order("ordem", { ascending: true })
    .order("hora_inicio", { ascending: true })
    .limit(200);

  if (data) {
    query = query.eq("data_inicio", data);
  }

  if (coluna) {
    query = query.eq("coluna_kanban", coluna);
  }

  if (clienteNome) {
    query = query.eq("cliente_nome", clienteNome);
  }

  const { data: tarefas, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tarefas: tarefas || [] });
}

// POST /api/tarefas - cria nova tarefa
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const {
    cliente_id,
    cliente_nome,
    titulo,
    descricao,
    tipo,
    prioridade = "media",
    coluna_kanban = "a_fazer",
    data_inicio,
    hora_inicio,
    data_fim,
    hora_fim,
    vendedor_id,
  } = body;

  if (!titulo || !tipo) {
    return NextResponse.json({ error: "Título e tipo são obrigatórios" }, { status: 400 });
  }

  const targetVendedorId = vendedor_id || user.id;

  // Verifica permissão se criando para outro vendedor
  if (targetVendedorId !== user.id) {
    const { data: meuPerfil } = await supabase
      .from("profiles")
      .select("cargo")
      .eq("id", user.id)
      .single();

    const isDiretoria = ["diretor", "admin"].includes(meuPerfil?.cargo || "");
    const { data: vendedorAlvo } = await supabase
      .from("profiles")
      .select("gestor_id")
      .eq("id", targetVendedorId)
      .single();

    const isMeuVendedor = vendedorAlvo?.gestor_id === user.id;

    if (!isDiretoria && !isMeuVendedor) {
      return NextResponse.json({ error: "Sem permissão para criar tarefa para este vendedor" }, { status: 403 });
    }
  }

  // Pega a maior ordem da coluna
  const { data: ultimaOrdem } = await supabase
    .from("tarefas")
    .select("ordem")
    .eq("vendedor_id", targetVendedorId)
    .eq("coluna_kanban", coluna_kanban)
    .order("ordem", { ascending: false })
    .limit(1)
    .single();

  const novaOrdem = (ultimaOrdem?.ordem || 0) + 1;

  const { data: tarefa, error } = await supabase
    .from("tarefas")
    .insert({
      vendedor_id: targetVendedorId,
      cliente_id: cliente_id || null,
      cliente_nome: cliente_nome || null,
      titulo,
      descricao: descricao || null,
      tipo,
      prioridade,
      status: "pendente",
      coluna_kanban,
      ordem: novaOrdem,
      data_inicio: data_inicio || null,
      hora_inicio: hora_inicio || null,
      data_fim: data_fim || null,
      hora_fim: hora_fim || null,
    })
    .select("*, clientes(id, nome_razao_social)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, tarefa });
}

// PATCH /api/tarefas - atualiza tarefa (status, coluna, ordem, resultado)
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { id, titulo, descricao, prioridade, coluna_kanban, ordem, status, resultado, observacao_resultado, valor_venda, cliente_nome } = body;

  if (!id) {
    return NextResponse.json({ error: "ID da tarefa é obrigatório" }, { status: 400 });
  }

  // Verifica se usuário é gestor
  const { data: meuPerfil } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("id", user.id)
    .single();
  const isGestor = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");

  const updateData: any = {};
  if (cliente_nome !== undefined) updateData.cliente_nome = cliente_nome;
  if (titulo !== undefined) updateData.titulo = titulo;
  if (descricao !== undefined) updateData.descricao = descricao;
  if (prioridade !== undefined) updateData.prioridade = prioridade;
  if (coluna_kanban !== undefined) updateData.coluna_kanban = coluna_kanban;
  if (ordem !== undefined) updateData.ordem = ordem;
  if (status !== undefined) updateData.status = status;
  if (resultado !== undefined) updateData.resultado = resultado;
  if (observacao_resultado !== undefined) updateData.observacao_resultado = observacao_resultado;
  if (valor_venda !== undefined) updateData.valor_venda = valor_venda;

  if (coluna_kanban === "concluida") {
    updateData.status = "concluida";
  } else if (coluna_kanban === "em_andamento") {
    updateData.status = "em_andamento";
  } else if (coluna_kanban === "a_fazer") {
    updateData.status = "pendente";
  }

  const { data: tarefa, error } = await supabase
    .from("tarefas")
    .update(updateData)
    .eq("id", id)
    .select("*, clientes(id, nome_razao_social)")
    .single();

  if (error || !tarefa) {
    console.error("[API PATCH tarefas] Error:", error);
    return NextResponse.json({ error: "Tarefa não encontrada ou sem permissão", details: error?.message }, { status: 404 });
  }

  return NextResponse.json({ success: true, tarefa });
}

// DELETE /api/tarefas?id=xxx
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID da tarefa é obrigatório" }, { status: 400 });
  }

  // Verifica se usuário é gestor
  const { data: meuPerfil } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("id", user.id)
    .single();
  const isGestor = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");

  let deleteQuery = supabase.from("tarefas").delete().eq("id", id);
  if (!isGestor) {
    deleteQuery = deleteQuery.eq("vendedor_id", user.id);
  }

  const { error, count } = await deleteQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Se nenhuma linha foi deletada, significa que não tinha permissão ou não existia
  if (count === 0) {
    const { data: existe } = await supabase.from("tarefas").select("id").eq("id", id).single();
    if (existe) {
      return NextResponse.json({ error: "Sem permissão para excluir esta tarefa" }, { status: 403 });
    }
  }

  return NextResponse.json({ success: true });
}
