import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/tarefas/resumo?periodo=dia&data=2026-07-16
 * GET /api/tarefas/resumo?periodo=mes&data=2026-07-01
 * GET /api/tarefas/resumo?periodo=ano&data=2026-01-01
 * GET /api/tarefas/resumo?periodo=personalizado&inicio=2026-07-01&fim=2026-07-31
 *
 * Retorna:
 * - total_vendas: soma de valor_venda (resultado = 'sucesso')
 * - quantidade_vendas: quantidade de tarefas com resultado = 'sucesso'
 * - ticket_medio: total / quantidade
 * - total_tarefas: total de tarefas no período
 * - tarefas_por_resultado: contagem por tipo de resultado
 * - vendas_por_periodo: vendas agrupadas (por dia, semana ou mês)
 * - meta: meta do período (se configurada)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get("periodo") || "dia"; // dia, mes, ano, personalizado
    const modo = searchParams.get("modo"); // "cliente" retorna tarefas agrupadas por cliente
    const dataParam = searchParams.get("data") || new Date().toISOString().split("T")[0];
    const inicioParam = searchParams.get("inicio");
    const fimParam = searchParams.get("fim");

    // Verifica se é gestor
    const { data: meuPerfil } = await supabase
      .from("profiles")
      .select("cargo")
      .eq("id", user.id)
      .single();
    const isGestor = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");

    // Usa service_role para ter acesso amplo
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Calcula período
    let dataInicio: string;
    let dataFim: string;

    if (periodo === "personalizado" && inicioParam && fimParam) {
      dataInicio = inicioParam + "T00:00:00.000Z";
      dataFim = fimParam + "T23:59:59.999Z";
    } else if (periodo === "dia") {
      dataInicio = dataParam + "T00:00:00.000Z";
      dataFim = dataParam + "T23:59:59.999Z";
    } else if (periodo === "mes") {
      const dt = new Date(dataParam);
      const ultimoDiaMes = new Date(dt.getFullYear(), dt.getMonth() + 1, 0);
      dataInicio = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-01T00:00:00.000Z`;
      dataFim = `${ultimoDiaMes.getFullYear()}-${String(ultimoDiaMes.getMonth() + 1).padStart(2, "0")}-${String(ultimoDiaMes.getDate()).padStart(2, "0")}T23:59:59.999Z`;
    } else {
      // ano
      const dt = new Date(dataParam);
      dataInicio = `${dt.getFullYear()}-01-01T00:00:00.000Z`;
      dataFim = `${dt.getFullYear()}-12-31T23:59:59.999Z`;
    }

    // Busca todas as tarefas do período
    let query = supabaseAdmin
      .from("tarefas")
      .select("id, resultado, valor_venda, coluna_kanban, data_inicio, created_at, vendedor_id, cliente_nome")
      .gte("created_at", dataInicio)
      .lte("created_at", dataFim)
      .order("created_at", { ascending: true });

    // Se não é gestor, filtra pelo vendedor logado
    if (!isGestor) {
      query = query.eq("vendedor_id", user.id);
    }

    const { data: tarefas, error } = await query;

    if (error) {
      console.error("[API tarefas/resumo] Erro:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const todasTarefas = tarefas || [];

    // Modo "cliente" — retorna tarefas ativas agrupadas por cliente
    if (modo === "cliente") {
      const tarefasAtivas = todasTarefas.filter((t) => t.coluna_kanban !== "concluida");
      const porCliente: Record<string, number> = {};
      tarefasAtivas.forEach((t: any) => {
        const nome = t.cliente_nome || t.clientes?.nome_razao_social || null;
        if (nome) {
          porCliente[nome] = (porCliente[nome] || 0) + 1;
        }
      });
      return NextResponse.json({ porCliente });
    }

    // Calcula métricas
    const tarefasSucesso = todasTarefas.filter((t) => t.resultado === "sucesso" || t.resultado === "sucesso");
    const totalVendas = tarefasSucesso.reduce((sum, t) => sum + (t.valor_venda || 0), 0);
    const quantidadeVendas = tarefasSucesso.length;
    const ticketMedio = quantidadeVendas > 0 ? totalVendas / quantidadeVendas : 0;

    // Contagem por resultado
    const tarefasPorResultado: Record<string, number> = {
      sucesso: 0,
      insucesso: 0,
      remarcado: 0,
      sem_contato: 0,
      follow_up_necessario: 0,
      pendente: 0,
    };
    todasTarefas.forEach((t) => {
      if (t.resultado && tarefasPorResultado[t.resultado] !== undefined) {
        tarefasPorResultado[t.resultado]++;
      } else if (t.coluna_kanban !== "concluida") {
        tarefasPorResultado.pendente++;
      }
    });

    // Vendas agrupadas por período (para gráfico)
    const vendasPorPeriodo: { label: string; valor: number; quantidade: number }[] = [];
    
    if (periodo === "dia") {
      // Agrupar por hora
      const agrupado: Record<string, { valor: number; quantidade: number }> = {};
      for (let h = 0; h < 24; h++) {
        agrupado[`${String(h).padStart(2, "0")}:00`] = { valor: 0, quantidade: 0 };
      }
      tarefasSucesso.forEach((t) => {
        const dt = new Date(t.created_at);
        const hora = `${String(dt.getHours()).padStart(2, "0")}:00`;
        if (agrupado[hora]) {
          agrupado[hora].valor += t.valor_venda || 0;
          agrupado[hora].quantidade++;
        }
      });
      Object.entries(agrupado).forEach(([label, dados]) => {
        if (dados.quantidade > 0) {
          vendasPorPeriodo.push({ label, valor: dados.valor, quantidade: dados.quantidade });
        }
      });
    } else if (periodo === "mes") {
      // Agrupar por dia
      const agrupado: Record<string, { valor: number; quantidade: number }> = {};
      tarefasSucesso.forEach((t) => {
        const dt = new Date(t.created_at);
        const dia = `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
        if (!agrupado[dia]) agrupado[dia] = { valor: 0, quantidade: 0 };
        agrupado[dia].valor += t.valor_venda || 0;
        agrupado[dia].quantidade++;
      });
      Object.entries(agrupado).forEach(([label, dados]) => {
        vendasPorPeriodo.push({ label, valor: dados.valor, quantidade: dados.quantidade });
      });
    } else {
      // Agrupar por mês
      const agrupado: Record<string, { valor: number; quantidade: number }> = {};
      tarefasSucesso.forEach((t) => {
        const dt = new Date(t.created_at);
        const mes = `${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
        if (!agrupado[mes]) agrupado[mes] = { valor: 0, quantidade: 0 };
        agrupado[mes].valor += t.valor_venda || 0;
        agrupado[mes].quantidade++;
      });
      Object.entries(agrupado).forEach(([label, dados]) => {
        vendasPorPeriodo.push({ label, valor: dados.valor, quantidade: dados.quantidade });
      });
    }

    // Meta do período
    let meta = 0;
    if (periodo === "dia") meta = 2000;
    else if (periodo === "mes") meta = 50000;
    else if (periodo === "ano") meta = 600000;

    const percentualMeta = meta > 0 ? Math.min(Math.round((totalVendas / meta) * 100), 999) : 0;

    return NextResponse.json({
      periodo,
      data_inicio: dataInicio,
      data_fim: dataFim,
      total_vendas: totalVendas,
      quantidade_vendas: quantidadeVendas,
      ticket_medio: ticketMedio,
      total_tarefas: todasTarefas.length,
      tarefas_por_resultado: tarefasPorResultado,
      vendas_por_periodo: vendasPorPeriodo,
      meta,
      percentual_meta: percentualMeta,
    });
  } catch (err: any) {
    console.error("[API tarefas/resumo] Catch error:", err);
    return NextResponse.json({ error: err?.message || "Erro interno" }, { status: 500 });
  }
}