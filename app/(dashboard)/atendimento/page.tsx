"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { PerformanceRealTime } from "@/components/features/atendimento/performance-realtime";
import { ListaAtendimentosLateral } from "@/components/features/atendimento/lista-atendimentos-lateral";
import { ChatInline } from "@/components/features/atendimento/chat-inline";
import { TogglePresenca } from "@/components/features/atendimento/toggle-presenca";
import { PainelContato } from "@/components/features/atendimento/painel-contato";
import { FiltroEtiquetas } from "@/components/features/atendimento/filtro-etiquetas";
import { Search, Calendar, HelpCircle, Bell } from "lucide-react";
import { SimularWhatsAppModal } from "@/components/features/atendimento/simular-whatsapp-modal";
import { createClient } from "@/lib/supabase/client";

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

export default function AtendimentoPage() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loadingAtendimentos, setLoadingAtendimentos] = useState(true);
  const supabase = createClient();

  // Filtros gerais (busca + data — status agora é por componente)
  const [busca, setBusca] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  // Estado do chat inline e painel de contato
  const [atendimentoChat, setAtendimentoChat] = useState<Atendimento | null>(null);
  const [painelContatoAberto, setPainelContatoAberto] = useState(true);
  const [etiquetaFiltro, setEtiquetaFiltro] = useState<string | null>(null);
  const [atendimentosComEtiquetas, setAtendimentosComEtiquetas] = useState<Record<string, string[]>>({});
  const [userCargo, setUserCargo] = useState<string>("");

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

    // Filtro por etiqueta
    let matchEtiqueta = true;
    if (etiquetaFiltro) {
      const etiquetasDoAtendimento = atendimentosComEtiquetas[a.id] || [];
      matchEtiqueta = etiquetasDoAtendimento.includes(etiquetaFiltro);
    }

    return matchBusca && matchData && matchEtiqueta;
  });

  const fetchAtendimentos = useCallback(async (silent = false) => {
    if (!silent) setLoadingAtendimentos(true);
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
      if (!silent) setLoadingAtendimentos(false);
    }
  }, [supabase]);

  // Buscar todas as etiquetas vinculadas a atendimentos (para o filtro)
  const fetchEtiquetasAtendimentos = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/atendimentos/etiquetas?todos=true", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setAtendimentosComEtiquetas(data.mapa || {});
      }
    } catch (err) {
      console.error(err);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAtendimentos();
    fetchEtiquetasAtendimentos();
    // Busca cargo do usuário para mostrar simular WhatsApp
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("cargo")
          .eq("id", user.id)
          .single();
        if (profile?.cargo) setUserCargo(profile.cargo);
      }
    })();
  }, [fetchAtendimentos, fetchEtiquetasAtendimentos, supabase]);

  // Polling: atualiza lista a cada 15s em background (sem loading visual)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAtendimentos(true); // silent = true
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchAtendimentos]);

  // Sincronizar atendimentoChat com a lista atualizada (para mostrar novas mensagens)
  useEffect(() => {
    if (atendimentoChat && atendimentos.length > 0) {
      const atualizado = atendimentos.find((a) => a.id === atendimentoChat.id);
      if (atualizado) {
        setAtendimentoChat(atualizado);
      }
    }
  }, [atendimentos]);

  const handleAbrirChat = (a: Atendimento) => {
    setAtendimentoChat(a);
  };

  const handleFecharAtendimento = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/atendimentos", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, status: "fechado" }),
      });

      if (res.ok) {
        setAtendimentoChat(null);
        await fetchAtendimentos();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Data de hoje formatada
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="h-[calc(100vh-9rem)] flex flex-col overflow-hidden">
      
      {/* HEADER COMPACTO — Toggle + Performance + Data + Busca + Ícones */}
      <div className="shrink-0 flex items-center gap-3 mb-2">
        <TogglePresenca />
        <PerformanceRealTime />

        <div className="flex items-center gap-3 ml-auto shrink-0">
          {/* Data */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar className="h-3.5 w-3.5" />
            <span className="capitalize">{hoje}</span>
          </div>

          {/* Botão Simular WhatsApp — apenas para demonstração */}
          {userCargo === "demonstracao" && (
            <SimularWhatsAppModal onSuccess={fetchAtendimentos} />
          )}

          {/* Busca geral */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Buscar..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-48 h-8 text-xs pl-7"
            />
          </div>

          {/* Botão info painel lateral */}
          <button
            onClick={() => setPainelContatoAberto(!painelContatoAberto)}
            className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors ${
              painelContatoAberto
                ? "bg-blue-50 border-blue-200 text-blue-600"
                : "bg-white border-slate-200 text-slate-400 hover:text-slate-600"
            }`}
            title={painelContatoAberto ? "Fechar painel de contato" : "Abrir painel de contato"}
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* WhatsApp Web 3 COLUNAS: Lista + Chat + Painel Contato */}
      <div className="flex-1 min-h-0 flex border border-slate-200 rounded-lg overflow-hidden bg-white">
        
        {/* PAINEL ESQUERDO: Lista de conversas */}
        <div className="w-[320px] min-w-[280px] flex flex-col border-r border-slate-200 bg-white">
          {/* Busca dentro da lista */}
          <div className="shrink-0 px-3 py-2 border-b border-slate-100 space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Buscar conversa..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full h-8 text-xs pl-7"
              />
            </div>
            <FiltroEtiquetas
              etiquetaSelecionada={etiquetaFiltro}
              onSelecionar={setEtiquetaFiltro}
            />
          </div>
          {/* Lista */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ListaAtendimentosLateral
              atendimentos={atendimentosFiltrados}
              loading={loadingAtendimentos}
              onRefresh={fetchAtendimentos}
              onAbrirChat={handleAbrirChat}
              etiquetas={atendimentosComEtiquetas}
            />
          </div>
        </div>

        {/* PAINEL CENTRAL: Chat */}
        <div className="flex-1 min-w-0">
          <ChatInline
            atendimento={atendimentoChat}
            onMarcarResolvido={handleFecharAtendimento}
            onMensagemEnviada={fetchAtendimentos}
            onFechar={() => setAtendimentoChat(null)}
          />
        </div>

        {/* PAINEL DIREITO: Info do contato — só aparece quando conversa selecionada */}
        {painelContatoAberto && atendimentoChat && (
          <div className="w-[320px] min-w-[280px]">
            <PainelContato
              atendimento={atendimentoChat}
              onFechar={() => setAtendimentoChat(null)}
              onMarcarConcluido={handleFecharAtendimento}
              onEtiquetaChange={fetchEtiquetasAtendimentos}
            />
          </div>
        )}
      </div>
    </div>
  );
}
