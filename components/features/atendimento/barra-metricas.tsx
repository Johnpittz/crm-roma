"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, DollarSign, Users, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Barra de métricas do atendimento - 4 cards compactos:
 * 1. Positivação (vendas no mês / total carteira)
 * 2. Vendas Ganhas vs Perdidas
 * 3. Meta x Tendência
 * 4. Margem Líquida
 */

interface MetricasData {
  positivacao: number;
  clientesCarteira: number;
  vendasNoMes: number;
  vendasGanhas: number;
  vendasPerdidas: number;
  metaMensal: number;
  realizadoMes: number;
  margemLiquida: number;
}

export function BarraMetricasAtendimento() {
  const [metricas, setMetricas] = useState<MetricasData>({
    positivacao: 0,
    clientesCarteira: 0,
    vendasNoMes: 0,
    vendasGanhas: 0,
    vendasPerdidas: 0,
    metaMensal: 20000,
    realizadoMes: 0,
    margemLiquida: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchMetricas() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Buscar total de clientes na carteira
        const clientesRes = await fetch("/api/clientes", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const clientesData = await clientesRes.json();
        const totalClientes = (clientesData.clientes || []).length;

        // Buscar vendas do mês
        const agora = new Date();
        const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
        const vendasRes = await fetch(`/api/vendas?data_inicio=${inicioMes}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const vendasData = await vendasRes.json();
        const vendas = vendasData.vendas || [];

        const vendasNoMes = vendas.length;
        const vendasGanhas = vendas.filter((v: any) => v.status === "ganha" || v.status === "aprovada").length;
        const vendasPerdidas = vendas.filter((v: any) => v.status === "perdida" || v.status === "cancelada").length;
        const realizadoMes = vendas.reduce((acc: number, v: any) => acc + (v.valor_total || 0), 0);

        // Calcular positivação
        const positivacao = totalClientes > 0 ? (vendasNoMes / totalClientes) * 100 : 0;

        // Meta (por enquanto fixa, depois pode vir do banco)
        const metaMensal = 20000;
        const percentualMeta = metaMensal > 0 ? (realizadoMes / metaMensal) * 100 : 0;

        // Margem estimada (30% padrão, depois pode vir do banco)
        const margemLiquida = realizadoMes * 0.3;

        setMetricas({
          positivacao,
          clientesCarteira: totalClientes,
          vendasNoMes,
          vendasGanhas,
          vendasPerdidas,
          metaMensal,
          realizadoMes,
          margemLiquida,
        });
      } catch (err) {
        console.error("Erro ao buscar métricas:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchMetricas();
    const interval = setInterval(fetchMetricas, 30000);
    return () => clearInterval(interval);
  }, [supabase]);

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3 mb-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const percentualMeta = metricas.metaMensal > 0
    ? Math.round((metricas.realizadoMes / metricas.metaMensal) * 100)
    : 0;

  return (
    <div className="grid grid-cols-4 gap-3 mb-3">
      {/* 1. Positivação */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Percent className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Positivação</p>
          <p className="text-xl font-bold text-slate-800">{metricas.positivacao.toFixed(1)}%</p>
          <p className="text-[10px] text-slate-400 truncate">
            {metricas.vendasNoMes} de {metricas.clientesCarteira} clientes
          </p>
        </div>
      </div>

      {/* 2. Vendas Ganhas vs Perdidas */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3">
        <div className="p-2 bg-emerald-50 rounded-lg">
          <TrendingUp className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Vendas</p>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-emerald-600">{metricas.vendasGanhas}</span>
            <span className="text-xs text-slate-400">ganhas</span>
            <span className="text-lg font-bold text-red-500">{metricas.vendasPerdidas}</span>
            <span className="text-xs text-slate-400">perdidas</span>
          </div>
          <p className="text-[10px] text-slate-400">este mês</p>
        </div>
      </div>

      {/* 3. Meta x Tendência */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3">
        <div className="p-2 bg-amber-50 rounded-lg">
          <Target className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Meta Mensal</p>
          <div className="flex items-baseline gap-2">
            <p className="text-xl font-bold text-slate-800">{percentualMeta}%</p>
            {percentualMeta >= 100 ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </div>
          <p className="text-[10px] text-slate-400">
            R$ {metricas.realizadoMes.toLocaleString("pt-BR")} / R$ {metricas.metaMensal.toLocaleString("pt-BR")}
          </p>
        </div>
      </div>

      {/* 4. Margem Líquida */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3">
        <div className="p-2 bg-violet-50 rounded-lg">
          <DollarSign className="h-5 w-5 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Margem Líquida</p>
          <p className="text-xl font-bold text-slate-800">
            R$ {metricas.margemLiquida.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-slate-400">estimada (30%)</p>
        </div>
      </div>
    </div>
  );
}
