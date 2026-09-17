"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Gráfico Realizado vs Meta Acumulada
 * - Barras verticais: realização acumulada por mês
 * - Tendência linear (tracejada)
 * - Indicadores: Acumulado, Tendência Anual, Meta Anual, Realizado
 */

interface MesData {
  mes: string;
  mesCurto: string;
  realizado: number;
  meta: number;
}

interface GraficoProps {
  meses: MesData[];
  metaAnual: number;
  realizadoAnual: number;
  tendencia: number;
}

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function GraficoRealizadoMeta() {
  const [data, setData] = useState<GraficoProps>({
    meses: [],
    metaAnual: 500000,
    realizadoAnual: 0,
    tendencia: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchDados() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const agora = new Date();
        const anoAtual = agora.getFullYear();
        const metaAnual = 500000; // Meta fixa por enquanto

        // Buscar vendas do ano
        const inicioAno = new Date(anoAtual, 0, 1).toISOString();
        const res = await fetch(`/api/vendas?data_inicio=${inicioAno}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const vendasData = await res.json();
        const vendas = vendasData.vendas || [];

        // Agrupar por mês e calcular acumulado
        const mesesMap: Record<number, number> = {};
        for (let i = 0; i < 12; i++) mesesMap[i] = 0;

        vendas.forEach((v: any) => {
          const d = new Date(v.created_at || v.data);
          if (d.getFullYear() === anoAtual) {
            mesesMap[d.getMonth()] += v.valor_total || 0;
          }
        });

        // Calcular acumulado
        const meses: MesData[] = [];
        let acumulado = 0;
        const mesAtual = agora.getMonth();

        for (let i = 0; i <= mesAtual; i++) {
          acumulado += mesesMap[i];
          meses.push({
            mes: String(i + 1).padStart(2, "0"),
            mesCurto: MESES_ABREV[i],
            realizado: acumulado,
            meta: metaAnual / 12 * (i + 1),
          });
        }

        // Tendência: projeção linear baseada nos meses até agora
        const mesesComDados = mesAtual + 1;
        const mediaMensal = acumulado / mesesComDados;
        const tendencia = mediaMensal * 12;

        setData({
          meses,
          metaAnual,
          realizadoAnual: acumulado,
          tendencia: Math.round(tendencia),
        });
      } catch (err) {
        console.error("Erro ao buscar dados do gráfico:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDados();
    const interval = setInterval(fetchDados, 60000);
    return () => clearInterval(interval);
  }, [supabase]);

  if (loading) {
    return (
      <Card className="border border-slate-200">
        <CardContent className="p-4">
          <div className="h-48 bg-slate-100 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (data.meses.length === 0) {
    return (
      <Card className="border border-slate-200">
        <CardContent className="p-4">
          <p className="text-sm text-slate-400 text-center py-8">Sem dados de vendas para exibir</p>
        </CardContent>
      </Card>
    );
  }

  // Valores para o gráfico
  const maxValor = Math.max(data.metaAnual, data.realizadoAnual, data.tendencia);
  const maxBarra = data.meses[data.meses.length - 1]?.meta || data.metaAnual;

  // Trendline points
  const trendPoints = data.meses.map((m, i) => {
    const x = 40 + (i * (data.meses.length > 1 ? (data.meses.length * 35) / (data.meses.length - 1) : 0));
    const y = 140 - (data.meses[i].realizado / maxBarra) * 100;
    return `${x},${y}`;
  }).join(" ");

  return (
    <Card className="border border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700">Realizado vs Meta Acumulada</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {/* Gráfico SVG */}
        <div className="relative">
          <svg width="100%" viewBox={`0 0 ${Math.max(data.meses.length * 35 + 60, 300)} 160`} className="w-full">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <g key={pct}>
                <line
                  x1="40" y1={140 - pct * 100}
                  x2={40 + (data.meses.length - 1) * 35} y2={140 - pct * 100}
                  stroke="#e2e8f0" strokeWidth="1"
                />
                <text x="35" y={143 - pct * 100} textAnchor="end" fontSize="9" fill="#94a3b8">
                  {((maxBarra * pct) / 1000).toFixed(0)}k
                </text>
              </g>
            ))}

            {/* Meta line */}
            <line
              x1="40" y1={140 - 100}
              x2={40 + (data.meses.length - 1) * 35} y2={140 - 100}
              stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4"
            />
            <text
              x={40 + (data.meses.length - 1) * 35 + 5}
              y={140 - 100 + 4}
              fontSize="10" fill="#ef4444" fontWeight="bold"
            >
              META
            </text>

            {/* Barras realizadas */}
            {data.meses.map((mes, i) => {
              const x = 40 + i * 35;
              const altBarra = (mes.realizado / maxBarra) * 100;
              const altMeta = (mes.meta / maxBarra) * 100;
              const isLast = i === data.meses.length - 1;

              return (
                <g key={i}>
                  {/* Barra meta (fundo) */}
                  <rect
                    x={x - 10} y={140 - altMeta}
                    width="20" height={altMeta}
                    fill="#e2e8f0" rx="3"
                  />
                  {/* Barra realizado */}
                  <rect
                    x={x - 10} y={140 - altBarra}
                    width="20" height={altBarra}
                    fill={isLast ? "#15317b" : "#94a3b8"}
                    rx="3"
                  />
                  {/* Valor em cima */}
                  <text
                    x={x} y={138 - altBarra}
                    textAnchor="middle" fontSize="9" fill="#334155"
                  >
                    {(mes.realizado / 1000).toFixed(0)}k
                  </text>
                  {/* Label mês */}
                  <text
                    x={x} y={155}
                    textAnchor="middle" fontSize="10"
                    fill={isLast ? "#15317b" : "#64748b"}
                    fontWeight={isLast ? "bold" : "normal"}
                  >
                    {mes.mesCurto}
                  </text>
                </g>
              );
            })}

            {/* Trendline */}
            {trendPoints.split(" ").length > 1 && (
              <polyline
                points={trendPoints}
                fill="none"
                stroke="#15317b"
                strokeWidth="2"
                strokeDasharray="6 3"
                opacity="0.6"
              />
            )}
          </svg>
        </div>

        {/* Indicadores */}
        <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100">
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase">Acumulado</p>
            <p className="text-sm font-bold text-slate-800">
              R$ {(data.realizadoAnual / 1000).toFixed(0)}k
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase">Tendência Anual</p>
            <p className={cn("text-sm font-bold", data.tendencia >= data.metaAnual ? "text-emerald-600" : "text-amber-600")}>
              R$ {(data.tendencia / 1000).toFixed(0)}k
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase">Meta Anual</p>
            <p className="text-sm font-bold text-slate-800">
              R$ {(data.metaAnual / 1000).toFixed(0)}k
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase">Realizado</p>
            <p className="text-sm font-bold text-slate-800">
              R$ {(data.realizadoAnual / 1000).toFixed(0)}k
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
