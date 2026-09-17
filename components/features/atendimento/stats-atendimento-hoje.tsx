"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageSquare, Phone, CheckCircle2, Clock } from "lucide-react";

interface StatsHoje {
  atendimentosHoje: number;
  abertos: number;
  resolvidos: number;
  tempoMedio: number;
}

export function StatsAtendimentoHoje() {
  const [stats, setStats] = useState<StatsHoje>({
    atendimentosHoje: 0,
    abertos: 0,
    resolvidos: 0,
    tempoMedio: 0,
  });
  const supabase = createClient();

  useEffect(() => {
    async function fetchStats() {
      try {
        const hoje = new Date().toISOString().split("T")[0];

        // Busca atendimentos de hoje
        const { data: atendimentos } = await supabase
          .from("atendimentos")
          .select("status, created_at, ultima_mensagem_data")
          .gte("created_at", hoje + "T00:00:00")
          .lte("created_at", hoje + "T23:59:59");

        const total = atendimentos?.length || 0;
        const abertos = atendimentos?.filter((a) => a.status === "aberto").length || 0;
        const resolvidos = atendimentos?.filter((a) => a.status === "fechado").length || 0;

        setStats({
          atendimentosHoje: total,
          abertos,
          resolvidos,
          tempoMedio: 0,
        });
      } catch (err) {
        console.error("Erro ao buscar stats:", err);
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [supabase]);

  return (
    <div className="flex items-center gap-4 px-3 py-1.5 bg-white rounded-lg border border-slate-200">
      <div className="flex items-center gap-1.5">
        <Phone className="h-3 w-3 text-blue-500" />
        <span className="text-[10px] text-slate-400">Atendimentos Hoje</span>
        <span className="text-[11px] font-bold text-slate-700">{stats.atendimentosHoje}</span>
      </div>
      <div className="w-px h-4 bg-slate-200" />
      <div className="flex items-center gap-1.5">
        <MessageSquare className="h-3 w-3 text-yellow-500" />
        <span className="text-[10px] text-slate-400">Abertos</span>
        <span className="text-[11px] font-bold text-yellow-600">{stats.abertos}</span>
      </div>
      <div className="w-px h-4 bg-slate-200" />
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="h-3 w-3 text-green-500" />
        <span className="text-[10px] text-slate-400">Resolvidos</span>
        <span className="text-[11px] font-bold text-green-600">{stats.resolvidos}</span>
      </div>
    </div>
  );
}
