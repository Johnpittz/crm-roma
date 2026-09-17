"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Send,
  MessageSquare,
  Handshake,
  CheckCircle2,
  Search,
  X,
  RefreshCw,
  Filter,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  prioridade: string;
  status: string;
  coluna_kanban: string;
  ordem: number;
  cliente_nome: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  resultado: string | null;
  observacao_resultado: string | null;
  vendedor_id: string;
}

const COLUNAS = [
  { id: "a_fazer", titulo: "Enviado, sem retorno", icone: Send, cor: "bg-slate-100", corIcon: "text-slate-500", corBadge: "bg-slate-200 text-slate-700" },
  { id: "em_andamento", titulo: "Negociação Inicial", icone: MessageSquare, cor: "bg-blue-50", corIcon: "text-blue-500", corBadge: "bg-blue-100 text-blue-700" },
  { id: "follow_up", titulo: "Negociação Final", icone: Handshake, cor: "bg-purple-50", corIcon: "text-purple-500", corBadge: "bg-purple-100 text-purple-700" },
  { id: "concluida", titulo: "Acordo Verbal", icone: CheckCircle2, cor: "bg-green-50", corIcon: "text-green-500", corBadge: "bg-green-100 text-green-700" },
];

const COLUNAS_MAP: Record<string, string> = {
  a_fazer: "Enviado, sem retorno",
  em_andamento: "Negociação Inicial",
  follow_up: "Negociação Final",
  concluida: "Acordo Verbal",
};

const PRIORIDADE_CORES: Record<string, string> = {
  alta: "bg-red-100 text-red-700",
  media: "bg-yellow-100 text-yellow-700",
  baixa: "bg-green-100 text-green-700",
};

function getPrioridadeCor(prioridade: string): string {
  return PRIORIDADE_CORES[prioridade] || "bg-slate-100 text-slate-700";
}

function getDataFormatada(data: string | null): string {
  if (!data) return "";
  const d = new Date(data + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function isAtrasada(tarefa: Tarefa): boolean {
  if (tarefa.coluna_kanban === "concluida" || !tarefa.data_fim) return false;
  return new Date(tarefa.data_fim) < new Date();
}

export function KanbanFunil() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroColuna, setFiltroColuna] = useState("__TODAS__");
  const [filtroPrioridade, setFiltroPrioridade] = useState("__TODAS__");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const supabase = createClient();

  const fetchTarefas = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams();
      if (busca.trim()) params.set("busca", busca.trim());

      const res = await fetch(`/api/tarefas?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setTarefas(data.tarefas || []);
    } catch (err) {
      console.error("Erro ao buscar tarefas:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, busca]);

  useEffect(() => {
    fetchTarefas();
  }, [fetchTarefas, refreshTrigger]);

  const getTarefasPorColuna = (colunaId: string): Tarefa[] => {
    return tarefas
      .filter((t) => t.coluna_kanban === colunaId)
      .filter((t) => {
        if (filtroPrioridade !== "__TODAS__" && t.prioridade !== filtroPrioridade) return false;
        if (dataInicio && t.data_inicio && t.data_inicio < dataInicio) return false;
        if (dataFim && t.data_fim && t.data_fim > dataFim) return false;
        return true;
      })
      .sort((a, b) => a.ordem - b.ordem);
  };

  const handleMoverTarefa = async (tarefaId: string, novaColuna: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch("/api/tarefas", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: tarefaId,
          coluna_kanban: novaColuna,
          status: novaColuna === "concluida" ? "concluida" : novaColuna === "em_andamento" ? "em_andamento" : "pendente",
        }),
      });

      setRefreshTrigger((t) => t + 1);
    } catch (err) {
      console.error("Erro ao mover tarefa:", err);
    }
  };

  const handleDeletarTarefa = async (tarefaId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta tarefa?")) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`/api/tarefas?id=${tarefaId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      setRefreshTrigger((t) => t + 1);
    } catch (err) {
      console.error("Erro ao deletar tarefa:", err);
    }
  };

  const handleDragStart = (e: React.DragEvent, tarefaId: string) => {
    e.dataTransfer.setData("tarefaId", tarefaId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, colunaId: string) => {
    e.preventDefault();
    const tarefaId = e.dataTransfer.getData("tarefaId");
    if (tarefaId) {
      handleMoverTarefa(tarefaId, colunaId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Carregando funil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header com filtros */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
          <Select value={filtroColuna} onValueChange={setFiltroColuna}>
            <SelectTrigger className="h-8 text-xs w-[160px]">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__TODAS__">Todas as colunas</SelectItem>
              {COLUNAS.map((col) => (
                <SelectItem key={col.id} value={col.id}>{col.titulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
            <SelectTrigger className="h-8 text-xs w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__TODAS__">Todas prioridades</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Buscar tarefa..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-[180px] h-8 text-xs pl-7"
            />
          </div>
          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-[120px] h-8 text-xs"
            />
            <span className="text-slate-400 text-xs">→</span>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-[120px] h-8 text-xs"
            />
          </div>
          {(busca || dataInicio || dataFim || filtroColuna !== "__TODAS__" || filtroPrioridade !== "__TODAS__") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => {
                setBusca("");
                setDataInicio("");
                setDataFim("");
                setFiltroColuna("__TODAS__");
                setFiltroPrioridade("__TODAS__");
              }}
            >
              <X className="h-3 w-3" />
              Limpar
            </Button>
          )}
        </div>

        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => setRefreshTrigger((t) => t + 1)}
          >
            <RefreshCw className="h-3 w-3" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 min-h-0 overflow-x-auto">
        <div className="flex gap-3 h-full min-w-max">
          {COLUNAS.filter((col) => filtroColuna === "__TODAS__" || col.id === filtroColuna).map((coluna) => {
            const tarefasColuna = getTarefasPorColuna(coluna.id);
            const Icone = coluna.icone;

            return (
              <div
                key={coluna.id}
                className={cn("flex flex-col rounded-lg h-full min-h-0 min-w-[260px] w-[260px]", coluna.cor)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, coluna.id)}
              >
                {/* Header da coluna */}
                <div className="flex items-center justify-between p-3 border-b border-slate-200/50">
                  <div className="flex items-center gap-2">
                    <Icone className={cn("h-4 w-4", coluna.corIcon)} />
                    <h3 className="font-semibold text-sm text-slate-700">{coluna.titulo}</h3>
                  </div>
                  <Badge className={cn("text-[10px] px-1.5 py-0", coluna.corBadge)}>
                    {tarefasColuna.length}
                  </Badge>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {tarefasColuna.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      Nenhuma tarefa
                    </div>
                  ) : (
                    tarefasColuna.map((tarefa) => (
                      <div
                        key={tarefa.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, tarefa.id)}
                        className={cn(
                          "bg-white rounded-lg p-3 border border-slate-200 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow",
                          isAtrasada(tarefa) && "border-red-300 bg-red-50"
                        )}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <p className="text-sm font-medium text-slate-800 line-clamp-2 flex-1">
                            {tarefa.titulo}
                          </p>
                          <div className="flex items-center gap-1 ml-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 text-slate-400 hover:text-blue-600"
                              onClick={() => handleMoverTarefa(
                                tarefa.id,
                                tarefa.coluna_kanban === "a_fazer" ? "em_andamento"
                                  : tarefa.coluna_kanban === "em_andamento" ? "follow_up"
                                  : "concluida"
                              )}
                            >
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 text-slate-400 hover:text-red-600"
                              onClick={() => handleDeletarTarefa(tarefa.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {tarefa.cliente_nome && (
                          <p className="text-xs text-slate-500 mb-1">{tarefa.cliente_nome}</p>
                        )}

                        {tarefa.descricao && (
                          <p className="text-xs text-slate-400 line-clamp-1 mb-1">{tarefa.descricao}</p>
                        )}

                        <div className="flex items-center justify-between mt-2">
                          <Badge className={cn("text-[10px] px-1.5 py-0", getPrioridadeCor(tarefa.prioridade))}>
                            {tarefa.prioridade}
                          </Badge>
                          {tarefa.data_fim && (
                            <span className={cn("text-[10px]", isAtrasada(tarefa) ? "text-red-500 font-medium" : "text-slate-400")}>
                              {isAtrasada(tarefa) && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}
                              {getDataFormatada(tarefa.data_fim)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
