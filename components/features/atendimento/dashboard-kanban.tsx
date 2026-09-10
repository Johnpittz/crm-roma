"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Phone,
  MessageSquare,
  Users,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  BarChart3,
  Target,
  ShoppingCart,
  DollarSign,
  Calendar,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface DashboardStats {
  totalTarefas: number;
  tarefasAFazer: number;
  tarefasEmAndamento: number;
  tarefasConcluidas: number;
  tarefasHoje: number;
  vendasTotal: number;
  vendasQuantidade: number;
  ticketMedio: number;
  atendimentosAbertos: number;
  atendimentosPendentes: number;
  clientesNovos: number;
  followUpsPendentes: number;
}

interface TarefaRecente {
  id: string;
  titulo: string;
  cliente_nome: string | null;
  coluna_kanban: string;
  prioridade: string;
  tipo: string;
  data_inicio: string | null;
  hora_inicio: string | null;
}

export function DashboardKanban() {
  const [stats, setStats] = useState<DashboardStats>({
    totalTarefas: 0,
    tarefasAFazer: 0,
    tarefasEmAndamento: 0,
    tarefasConcluidas: 0,
    tarefasHoje: 0,
    vendasTotal: 0,
    vendasQuantidade: 0,
    ticketMedio: 0,
    atendimentosAbertos: 0,
    atendimentosPendentes: 0,
    clientesNovos: 0,
    followUpsPendentes: 0,
  });
  const [tarefasRecentes, setTarefasRecentes] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const supabase = createClient();

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Buscar tarefas
      const tarefasRes = await fetch("/api/tarefas", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const tarefasData = await tarefasRes.json();
      const tarefas = tarefasData.tarefas || [];

      // Buscar atendimentos
      const atendRes = await fetch("/api/atendimentos", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const atendData = await atendRes.json();
      const atendimentos = atendData.atendimentos || [];

      // Buscar vendas
      const vendasRes = await fetch("/api/vendas", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const vendasData = await vendasRes.json();
      const vendas = vendasData.vendas || [];

      // Calcular estatísticas
      const hoje = new Date().toISOString().split("T")[0];
      const tarefasHoje = tarefas.filter((t: any) => t.data_inicio === hoje);

      setStats({
        totalTarefas: tarefas.length,
        tarefasAFazer: tarefas.filter((t: any) => t.coluna_kanban === "a_fazer").length,
        tarefasEmAndamento: tarefas.filter((t: any) => t.coluna_kanban === "em_andamento").length,
        tarefasConcluidas: tarefas.filter((t: any) => t.coluna_kanban === "concluida").length,
        tarefasHoje: tarefasHoje.length,
        vendasTotal: vendas.reduce((acc: number, v: any) => acc + (v.valor_total || 0), 0),
        vendasQuantidade: vendas.length,
        ticketMedio: vendas.length > 0 ? vendas.reduce((acc: number, v: any) => acc + (v.valor_total || 0), 0) / vendas.length : 0,
        atendimentosAbertos: atendimentos.filter((a: any) => a.status === "aberto").length,
        atendimentosPendentes: atendimentos.filter((a: any) => !a.vendedor_id).length,
        clientesNovos: 0, // Implementar se necessário
        followUpsPendentes: tarefas.filter((t: any) => t.tipo === "follow_up" && t.status !== "concluida").length,
      });

      // Tarefas recentes (últimas 5)
      setTarefasRecentes(tarefas.slice(0, 5));
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Erro ao carregar dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "alta": return "bg-red-100 text-red-700";
      case "media": return "bg-yellow-100 text-yellow-700";
      case "baixa": return "bg-green-100 text-green-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const getColunaIcon = (coluna: string) => {
    switch (coluna) {
      case "a_fazer": return <Clock className="h-4 w-4 text-slate-500" />;
      case "em_andamento": return <Activity className="h-4 w-4 text-blue-500" />;
      case "concluida": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default: return <Clock className="h-4 w-4 text-slate-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
        <span className="ml-2 text-slate-500">Carregando dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white p-8">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            <span className="text-sm font-medium text-blue-200">CRM ROMA Intelligence</span>
            <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-0 text-xs">
              ● Dados sincronizados
            </Badge>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            Sua operação, <span className="text-blue-200">em movimento.</span>
          </h1>
          <p className="text-blue-200 max-w-xl">
            Um centro de comando inteligente para enxergar prioridades, acompanhar o fluxo dos atendimentos e agir com mais clareza.
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-blue-200">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Leitura atualizada às {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="flex items-center gap-1">
              <RefreshCw className="h-4 w-4" />
              Visão consolidada dos canais
            </span>
          </div>
        </div>
        {/* Decoração */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-20">
          <BarChart3 className="h-32 w-32" />
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-medium">Pedidos Hoje</span>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                ● HOJE
              </Badge>
            </div>
            <p className="text-3xl font-bold text-slate-800">{stats.tarefasHoje}</p>
            <p className="text-xs text-slate-500 mt-1">Tarefas agendadas para hoje</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-medium">Faturamento</span>
              <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                ● HOJE
              </Badge>
            </div>
            <p className="text-3xl font-bold text-slate-800">{formatCurrency(stats.vendasTotal)}</p>
            <p className="text-xs text-slate-500 mt-1">Resultado acumulado do dia</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-medium">Vendas</span>
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                ● MÊS
              </Badge>
            </div>
            <p className="text-3xl font-bold text-slate-800">{stats.vendasQuantidade}</p>
            <p className="text-xs text-slate-500 mt-1">Total de vendas realizadas</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-medium">Ticket Médio</span>
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs">
                ● MÉDIA
              </Badge>
            </div>
            <p className="text-3xl font-bold text-slate-800">{formatCurrency(stats.ticketMedio)}</p>
            <p className="text-xs text-slate-500 mt-1">Valor médio por venda</p>
          </CardContent>
        </Card>
      </div>

      {/* Fluxo Operacional + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fluxo Operacional */}
        <Card className="lg:col-span-2 border border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Fluxo Operacional</p>
                <CardTitle className="text-lg font-bold text-slate-800">Atendimentos</CardTitle>
                <p className="text-xs text-slate-500">Acompanhe o volume e os pontos que precisam de ação.</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">NO MÊS</p>
                <p className="text-2xl font-bold text-blue-600">{stats.atendimentosAbertos + stats.atendimentosPendentes}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Phone className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-500">Abertos</p>
                  <p className="text-sm font-semibold text-slate-700">Aguardando atendimento</p>
                </div>
                <p className="text-lg font-bold text-slate-800">{stats.atendimentosAbertos}</p>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-500">Fila</p>
                  <p className="text-sm font-semibold text-slate-700">Sem vendedor atribuído</p>
                </div>
                <p className="text-lg font-bold text-slate-800">{stats.atendimentosPendentes}</p>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-500">Concluídos</p>
                  <p className="text-sm font-semibold text-slate-700">Atendimentos resolvidos</p>
                </div>
                <p className="text-lg font-bold text-slate-800">{stats.tarefasConcluidas}</p>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-500">Follow-up</p>
                  <p className="text-sm font-semibold text-slate-700">Acompanhamentos pendentes</p>
                </div>
                <p className="text-lg font-bold text-slate-800">{stats.followUpsPendentes}</p>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Radar Inteligente */}
        <Card className="border border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Radar Inteligente</p>
                <CardTitle className="text-lg font-bold text-slate-800">Pontos de atenção</CardTitle>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                ● AO VIVO
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Tarefas atrasadas</p>
                  <p className="text-xs text-slate-500">Últimos 7 dias</p>
                </div>
              </div>
              <p className="text-lg font-bold text-orange-600">0</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Phone className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Sem retorno</p>
                  <p className="text-xs text-slate-500">Clientes aguardando</p>
                </div>
              </div>
              <p className="text-lg font-bold text-red-600">{stats.atendimentosPendentes}</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Mensagens não lidas</p>
                  <p className="text-xs text-slate-500">Precisam de atenção</p>
                </div>
              </div>
              <p className="text-lg font-bold text-blue-600">0</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Target className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Meta do mês</p>
                  <p className="text-xs text-slate-500">Progresso atual</p>
                </div>
              </div>
              <p className="text-lg font-bold text-green-600">0%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tarefas Recentes + Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tarefas Recentes */}
        <Card className="border border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700">Tarefas Recentes</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-blue-600">
                Ver todas →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {tarefasRecentes.length > 0 ? (
              <div className="space-y-3">
                {tarefasRecentes.map((tarefa) => (
                  <div key={tarefa.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                    {getColunaIcon(tarefa.coluna_kanban)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{tarefa.titulo}</p>
                      <p className="text-xs text-slate-500 truncate">{tarefa.cliente_nome || "Sem cliente"}</p>
                    </div>
                    <Badge className={cn("text-[10px] px-1.5 py-0", getPrioridadeColor(tarefa.prioridade))}>
                      {tarefa.prioridade}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-sm">
                Nenhuma tarefa encontrada
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance */}
        <Card className="border border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700">Performance</CardTitle>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                ● AO VIVO
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Tarefas concluídas</span>
                <span className="text-xs font-semibold text-slate-700">
                  {stats.tarefasConcluidas}/{stats.totalTarefas}
                </span>
              </div>
              <Progress 
                value={stats.totalTarefas > 0 ? (stats.tarefasConcluidas / stats.totalTarefas) * 100 : 0} 
                className="h-2" 
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Em andamento</span>
                <span className="text-xs font-semibold text-blue-600">
                  {stats.tarefasEmAndamento}
                </span>
              </div>
              <Progress 
                value={stats.totalTarefas > 0 ? (stats.tarefasEmAndamento / stats.totalTarefas) * 100 : 0} 
                className="h-2 bg-blue-100"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">A fazer</span>
                <span className="text-xs font-semibold text-orange-600">
                  {stats.tarefasAFazer}
                </span>
              </div>
              <Progress 
                value={stats.totalTarefas > 0 ? (stats.tarefasAFazer / stats.totalTarefas) * 100 : 0} 
                className="h-2 bg-orange-100"
              />
            </div>

            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span>Total vendido: <strong className="text-slate-700">{formatCurrency(stats.vendasTotal)}</strong></span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
