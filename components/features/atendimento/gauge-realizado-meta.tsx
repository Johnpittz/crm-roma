"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface MetaData {
  realizado: number;
  meta: number;
  limite: number;
}

export function GaugeRealizadoMeta() {
  const [data, setData] = useState<MetaData>({ realizado: 0, meta: 2000, limite: 4800 });
  const supabase = createClient();

  useEffect(() => {
    async function fetchMeta() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Busca vendas do mês atual
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);

        const { data: vendas } = await supabase
          .from("vendas")
          .select("valor_total")
          .gte("created_at", inicioMes.toISOString());

        const realizado = (vendas || []).reduce((acc: number, v: any) => acc + (v.valor_total || 0), 0);

        // Meta mensal (pode vir de config depois)
        const meta = 2000;
        const limite = Math.round(meta * 1.2);

        setData({ realizado, meta, limite });
      } catch (err) {
        console.error("Erro ao buscar meta:", err);
      }
    }

    fetchMeta();
    const interval = setInterval(fetchMeta, 30000);
    return () => clearInterval(interval);
  }, [supabase]);

  const percentual = data.limite > 0 ? Math.min((data.realizado / data.limite) * 100, 100) : 0;
  const metaPercentual = data.limite > 0 ? (data.meta / data.limite) * 100 : 0;
  const atingiuMeta = data.realizado >= data.meta;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-white rounded-lg border border-slate-200">
      {/* Título */}
      <div className="text-[10px] font-semibold text-slate-600 leading-tight min-w-[70px]">
        REALIZADO<br />
        <span className="text-slate-400 font-normal">vs META</span>
      </div>

      {/* Gauge SVG compacto */}
      <div className="relative w-[100px] h-[40px]">
        <svg viewBox="0 0 120 60" className="w-full h-full">
          {/* Fundo do gauge (arco cinza) */}
          <path
            d="M 10 55 A 50 50 0 0 1 110 55"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Barra de realizado */}
          <path
            d="M 10 55 A 50 50 0 0 1 110 55"
            fill="none"
            stroke={atingiuMeta ? "#22c55e" : "#3b82f6"}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${percentual * 1.57} 157`}
            className="transition-all duration-1000"
          />
          {/* Marca da meta */}
          <circle
            cx={10 + 50 * Math.cos(Math.PI - (metaPercentual / 100) * Math.PI)}
            cy={55 - 50 * Math.sin((metaPercentual / 100) * Math.PI)}
            r="3"
            fill="#ef4444"
            stroke="white"
            strokeWidth="1"
          />
        </svg>
        {/* Percentual central */}
        <div className="absolute inset-0 flex items-end justify-center pb-0.5">
          <span className="text-[10px] font-bold text-slate-700">
            {Math.round(percentual)}%
          </span>
        </div>
      </div>

      {/* Valores */}
      <div className="flex flex-col gap-0.5 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Realizado:</span>
          <span className="font-semibold text-slate-700">
            {data.realizado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Meta:</span>
          <span className="font-semibold text-red-500">
            {data.meta.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </div>
      </div>
    </div>
  );
}
