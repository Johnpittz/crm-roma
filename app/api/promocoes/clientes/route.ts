import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { escopoCarteira, pertenceAoEscopo, idsDaEquipe } from "@/lib/carteira";

export const dynamic = "force-dynamic";

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/promocoes/clientes?produto_id=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const service = getServiceClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const produtoId = searchParams.get("produto_id");

  if (!produtoId) {
    return NextResponse.json({ error: "produto_id é obrigatório" }, { status: 400 });
  }

  // Busca todos os venda_itens que contêm este produto, com join em vendas e clientes
  const { data: itens, error: itensError } = await service
    .from("venda_itens")
    .select(`
      quantidade,
      valor_unitario,
      valor_total,
      venda:vendas!inner(
        id,
        cliente_id,
        data_venda,
        status,
        cliente:clientes!inner(
          id,
          nome_razao_social,
          telefone,
          celular,
          email,
          cidade,
          estado,
          vendedor_responsavel_id
        )
      )
    `)
    .eq("produto_id", produtoId);

  if (itensError) {
    return NextResponse.json({ error: itensError.message }, { status: 500 });
  }

  // Agrega por cliente
  const clientesMap = new Map<
    string,
    {
      cliente_id: string;
      nome_razao_social: string;
      telefone: string | null;
      celular: string | null;
      email: string | null;
      cidade: string | null;
      estado: string | null;
      vendedor_responsavel_id: string | null;
      total_compras: number;
      total_itens: number;
      valor_total_gasto: number;
      ultima_compra: string;
      primeira_compra: string;
    }
  >();

  for (const item of itens || []) {
    const venda = item.venda as any;
    if (!venda || venda.status === "cancelada") continue;

    const cliente = venda.cliente;
    if (!cliente) continue;

    const existing = clientesMap.get(cliente.id);

    if (existing) {
      existing.total_compras += 1;
      existing.total_itens += item.quantidade;
      existing.valor_total_gasto += item.valor_total;
      if (venda.data_venda > existing.ultima_compra) {
        existing.ultima_compra = venda.data_venda;
      }
      if (venda.data_venda < existing.primeira_compra) {
        existing.primeira_compra = venda.data_venda;
      }
    } else {
      clientesMap.set(cliente.id, {
        cliente_id: cliente.id,
        nome_razao_social: cliente.nome_razao_social,
        telefone: cliente.telefone,
        celular: cliente.celular,
        email: cliente.email,
        cidade: cliente.cidade,
        estado: cliente.estado,
        vendedor_responsavel_id: cliente.vendedor_responsavel_id,
        total_compras: 1,
        total_itens: item.quantidade,
        valor_total_gasto: item.valor_total,
        ultima_compra: venda.data_venda,
        primeira_compra: venda.data_venda,
      });
    }
  }

  const clientesOrdenados = Array.from(clientesMap.values()).sort(
    (a, b) => new Date(b.ultima_compra).getTime() - new Date(a.ultima_compra).getTime()
  );

  // REGRA DE CARTEIRA: vendedor só o dele; gestor a da própria equipe; direção tudo
  const { data: meuPerfil } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("id", user.id)
    .single();
  const escopo = escopoCarteira(meuPerfil?.cargo);
  const equipe = escopo === "equipe" ? await idsDaEquipe(service, user.id) : [];
  const clientes = clientesOrdenados.filter((c) =>
    pertenceAoEscopo(escopo, user.id, equipe, c.vendedor_responsavel_id)
  );

  return NextResponse.json({
    clientes,
    total: clientes.length,
  });
}