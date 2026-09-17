"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { TrendingUp, TrendingDown, Target, DollarSign, Percent, Activity } from "lucide-react";

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

        const clientesRes = await fetch("/api/clientes", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const clientesData = await clientesRes.json();
        const totalClientes = (clientesData.clientes || []).length;

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

        const positivacao = totalClientes > 0 ? (vendasNoMes / totalClientes) * 100 : 0;
        const metaMensal = 20000;
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
      <div className="grid grid-cols-5 gap-3 mb-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-lg animate-pulse" />
        ))}
        <div className="h-24 bg-slate-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  const percentualMeta = metricas.metaMensal > 0
    ? Math.round((metricas.realizadoMes / metricas.metaMensal) * 100)
    : 0;

  const gaugeMax = metricas.metaMensal * 1.2;
  const gaugePercent = Math.min((metricas.realizadoMes / gaugeMax) * 100, 100);
  const metaPercent = Math.min((metricas.metaMensal / gaugeMax) * 100, 100);

  return (
    <div className="grid grid-cols-5 gap-3 mb-3 shrink-0">
      {/* 1. Positivação */}
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-center gap-3">
        <div className="p-2.5 bg-blue-50 rounded-lg shrink-0">
          <Percent className="h-6 w-6 text-blue-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 uppercase tracking-wide leading-tight">Positivação</p>
          <p className="text-2xl font-bold text-slate-800 leading-tight">{metricas.positivacao.toFixed(1)}%</p>
          <p className="text-xs text-slate-400 truncate leading-tight">
            {metricas.vendasNoMes} de {metricas.clientesCarteira} clientes
          </p>
        </div>
      </div>

      {/* 2. Vendas Ganhas vs Perdidas */}
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-center gap-3">
        <div className="p-2.5 bg-emerald-50 rounded-lg shrink-0">
          <Activity className="h-6 w-6 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 uppercase tracking-wide leading-tight">Vendas</p>
          <div className="flex items-baseline gap-2 leading-tight">
            <span className="text-2xl font-bold text-emerald-600">{metricas.vendasGanhas}</span>
            <span className="text-xs text-slate-400">ganhas</span>
          </div>
          <div className="flex items-baseline gap-2 leading-tight">
            <span className="text-2xl font-bold text-red-500">{metricas.vendasPerdidas}</span>
            <span className="text-xs text-slate-400">perdidas</span>
          </div>
        </div>
      </div>

      {/* 3. Meta x Tendência */}
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-center gap-3">
        <div className="p-2.5 bg-amber-50 rounded-lg shrink-0">
          <Target className="h-6 w-6 text-amber-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 uppercase tracking-wide leading-tight">Meta Mensal</p>
          <div className="flex items-baseline gap-2 leading-tight">
            <p className="text-2xl font-bold text-slate-800">{percentualMeta}%</p>
            {percentualMeta >= 100 ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </div>
          <p className="text-xs text-slate-400 leading-tight">
            R$ {metricas.realizadoMes.toLocaleString("pt-BR")} / R$ {metricas.metaMensal.toLocaleString("pt-BR")}
          </p>
        </div>
      </div>

      {/* 4. Margem Líquida */}
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-center gap-3">
        <div className="p-2.5 bg-violet-50 rounded-lg shrink-0">
          <DollarSign className="h-6 w-6 text-violet-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 uppercase tracking-wide leading-tight">Margem Líquida</p>
          <p className="text-2xl font-bold text-slate-800 leading-tight">
            R$ {metricas.margemLiquida.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-slate-400 leading-tight">estimada (30%)</p>
        </div>
      </div>

      {/* 5. Gauge Realizado vs Meta Acumulada */}
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex flex-col items-center justify-center">
        <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Realizado vs Meta</p>
        <div className="relative w-[180px] h-[95px]">
          <svg viewBox="0 0 180 95" className="w-full h-full">
            <path
              d="M 12 88 A 78 78 0 0 1 168 88"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="16"
              strokeLinecap="round"
            />
            <path
              d="M 12 88 A 78 78 0 0 1 168 88"
              fill="none"
              stroke="#2563eb"
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={`${gaugePercent * 2.45} 245`}
              className="transition-all duration-1000"
            />
            <circle
              cx={12 + (metaPercent / 100) * 156}
              cy={88 - Math.sin((metaPercent / 100) * Math.PI) * 78}
              r="6"
              fill="#ef4444"
              stroke="white"
              strokeWidth="2"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
            <p className="text-xs text-slate-400 leading-tight">META</p>
            <p className="text-lg font-bold text-red-500 leading-tight">{metricas.metaMensal.toLocaleString("pt-BR")}</p>
          </div>
        </div>
        <div className="flex justify-between w-full mt-1.5">
          <div className="text-center">
            <p className="text-[9px] text-slate-400">REALIZADO</p>
            <p className="text-sm font-bold text-blue-600">{metricas.realizadoMes.toLocaleString("pt-BR")}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-slate-400">LIMITE</p>
            <p className="text-sm font-bold text-slate-500">{gaugeMax.toLocaleString("pt-BR")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
