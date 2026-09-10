"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, LayoutDashboard, Columns3 } from "lucide-react";
import { KanbanTarefas } from "@/components/features/atendimento/kanban-tarefas";
import { DashboardKanban } from "@/components/features/atendimento/dashboard-kanban";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Atendimento {
  id: string;
  telefone_cliente: string;
  nome_cliente: string;
  assunto: string;
  ultima_mensagem: string;
  ultima_mensagem_data: string;
  status: string;
  transbordado: boolean;
  nao_lido: boolean;
  vendedor_interagiu: boolean;
  ultima_mensagem_remetente: string | null;
  data_fechamento?: string | null;
  clientes: { id: string; nome_razao_social: string } | null;
}

export default function KanbanPage() {
  const [view, setView] = useState<"dashboard" | "kanban">("dashboard");
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loadingAtendimentos, setLoadingAtendimentos] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const supabase = createClient();

  // Filtros
  const [busca, setBusca] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const atendimentosFiltrados = atendimentos.filter((a) => {
    const termo = busca.toLowerCase().trim();
    const matchBusca =
      !termo ||
      a.nome_cliente?.toLowerCase().includes(termo) ||
      a.telefone_cliente?.toLowerCase().includes(termo) ||
      a.assunto?.toLowerCase().includes(termo) ||
      a.ultima_mensagem?.toLowerCase().includes(termo);

    let matchData = true;
    if (dataInicio || dataFim) {
      const dataMsg = a.ultima_mensagem_data
        ? new Date(a.ultima_mensagem_data)
        : null;
      if (dataMsg) {
        const inicio = dataInicio ? new Date(dataInicio + "T00:00:00") : null;
        const fim = dataFim ? new Date(dataFim + "T23:59:59") : null;
        if (inicio && dataMsg < inicio) matchData = false;
        if (fim && dataMsg > fim) matchData = false;
      }
    }

    return matchBusca && matchData;
  });

  const fetchAtendimentos = useCallback(async () => {
    setLoadingAtendimentos(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/atendimentos", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      if (res.ok) {
        setAtendimentos(data.atendimentos || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAtendimentos(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAtendimentos();
  }, [fetchAtendimentos]);

  const handleAbrirChat = () => {
    // No Kanban, não precisamos abrir chat
  };

  return (
    <div className="h-[calc(100vh-9rem)] flex flex-col overflow-hidden">
      
      {/* Header com toggle de visualização */}
      <div className="shrink-0 flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
          <Button
            size="sm"
            variant={view === "dashboard" ? "default" : "ghost"}
            className={cn(
              "h-8 text-xs px-3 gap-1",
              view === "dashboard"
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            )}
            onClick={() => setView("dashboard")}
          >
            <LayoutDashboard className="h-4 w-4" />
            Visão principal
          </Button>
          <Button
            size="sm"
            variant={view === "kanban" ? "default" : "ghost"}
            className={cn(
              "h-8 text-xs px-3 gap-1",
              view === "kanban"
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            )}
            onClick={() => setView("kanban")}
          >
            <Columns3 className="h-4 w-4" />
            Kanban
          </Button>
        </div>

        {/* FILTROS - só aparece no modo Kanban */}
        {view === "kanban" && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Buscar tarefa, cliente..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-[220px] h-8 text-xs pl-7"
              />
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-[130px] h-8 text-xs"
              />
              <span className="text-slate-400 text-xs">→</span>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-[130px] h-8 text-xs"
              />
            </div>
            {(busca || dataInicio || dataFim) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => {
                  setBusca("");
                  setDataInicio("");
                  setDataFim("");
                }}
              >
                <X className="h-3 w-3" />
                Limpar
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {view === "dashboard" ? (
          <div className="h-full overflow-y-auto pr-2">
            <DashboardKanban />
          </div>
        ) : (
          <KanbanTarefas
            atendimentos={atendimentosFiltrados}
            onAbrirChat={handleAbrirChat}
            onRefresh={fetchAtendimentos}
            onTarefaAtualizada={() => setRefreshTrigger((t) => t + 1)}
            busca={busca}
            dataInicio={dataInicio}
            dataFim={dataFim}
          />
        )}
      </div>
    </div>
  );
}
