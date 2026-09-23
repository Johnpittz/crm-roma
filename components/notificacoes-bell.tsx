"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Check, Trash2, MessageCircle, Mail, AlertTriangle, Target, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  dados: Record<string, any>;
  lida: boolean;
  created_at: string;
}

interface PreferenciasNotificacoes {
  canal_push: boolean;
  som_ativado: boolean;
  notif_atendimentos: boolean;
  notif_tarefas: boolean;
  notif_oportunidades: boolean;
  notif_metas_campanhas: boolean;
  notif_prospeccao: boolean;
}

const iconesPorTipo: Record<string, any> = {
  atendimento_novo: MessageCircle,
  atendimento_mensagem: MessageCircle,
  tarefa_nova: Mail,
  transbordo: AlertTriangle,
  meta_alcancada: Target,
};

const coresPorTipo: Record<string, string> = {
  atendimento_novo: "bg-green-100 text-green-700",
  atendimento_mensagem: "bg-blue-100 text-blue-700",
  tarefa_nova: "bg-purple-100 text-purple-700",
  transbordo: "bg-amber-100 text-amber-700",
  meta_alcancada: "bg-emerald-100 text-emerald-700",
};

/**
 * Sininho de notificações. Saiu do header do layout (removido em 23/09 para
 * ganhar altura na tela de Atendimento) e passou a ser posicionado pelo chamador
 * — hoje no topo da sidebar. `className` existe justamente para a sidebar escura.
 * Mantém polling, toast e som: é dele que as notificações chegam.
 */
export function NotificacoesBell({ className }: { className?: string } = {}) {
  const [aberto, setAberto] = useState(false);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [toastNotif, setToastNotif] = useState<Notificacao | null>(null);
  const [prefs, setPrefs] = useState<PreferenciasNotificacoes | null>(null);
  const [audio] = useState(() => {
    if (typeof Audio !== "undefined") {
      return new Audio("/sounds/notification.wav");
    }
    return null;
  });
  const supabase = createClient();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const notificacoesIdsRef = useRef<Set<string>>(new Set());

  // Verifica se uma notificação deve ser mostrada de acordo com as preferências
  const deveMostrarNotif = useCallback((tipo: string): boolean => {
    if (!prefs) return false; // não mostra nada até carregar prefs
    if (!prefs.canal_push) return false;

    const tipoLower = tipo.toLowerCase();
    if (tipoLower.includes("atendimento") || tipoLower.includes("transbordo")) {
      return prefs.notif_atendimentos;
    }
    if (tipoLower.includes("tarefa") || tipoLower.includes("prospec")) {
      return prefs.notif_tarefas;
    }
    if (tipoLower.includes("oportunidade")) {
      return prefs.notif_oportunidades;
    }
    if (tipoLower.includes("meta") || tipoLower.includes("campanha")) {
      return prefs.notif_metas_campanhas;
    }
    return true;
  }, [prefs]);

  const fetchNotificacoes = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/notificacoes", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;

      const data = await res.json();
      const novasNotifs: Notificacao[] = data.notificacoes || [];
      const novasNaoLidas = data.naoLidas || 0;

      // Detecta notificações novas usando ref (sem dependência do state)
      const idsAnteriores = notificacoesIdsRef.current;
      const notifsRealmenteNovas = novasNotifs.filter((n) => !idsAnteriores.has(n.id) && !n.lida);

      // Atualiza o ref com os IDs atuais
      notificacoesIdsRef.current = new Set(novasNotifs.map((n) => n.id));

      setNotificacoes(novasNotifs);
      setNaoLidas(novasNaoLidas);

      // Mostra toast e toca som apenas para notificações permitidas
      const notifParaToast = notifsRealmenteNovas.find((n) => deveMostrarNotif(n.tipo));
      if (notifParaToast) {
        setToastNotif(notifParaToast);
        if (audio && prefs?.som_ativado !== false) {
          audio.play().catch(() => {});
        }
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToastNotif(null), 5000);
      }
    } catch (err) {
      console.error("Erro ao buscar notificações:", err);
    }
  }, [supabase, audio, prefs, deveMostrarNotif]);

  // Busca preferências de notificações (direto do Supabase)
  useEffect(() => {
    async function fetchPrefs() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from("preferencias_notificacoes")
          .select("*")
          .eq("user_id", user.id)
          .single();
        if (error && error.code !== "PGRST116") return;
        if (data) {
          setPrefs({
            canal_push: data.canal_push ?? true,
            som_ativado: data.som_ativado ?? true,
            notif_atendimentos: data.notif_atendimentos ?? true,
            notif_tarefas: data.notif_tarefas ?? true,
            notif_oportunidades: data.notif_oportunidades ?? true,
            notif_metas_campanhas: data.notif_metas_campanhas ?? true,
            notif_prospeccao: data.notif_prospeccao ?? true,
          });
        }
      } catch {
        // silent fail
      }
    }
    fetchPrefs();
  }, [supabase]);

  // Busca inicial e polling a cada 120s (pausa quando aba invisível)
  // Reduzido de 60s para 120s para economizar recursos na Vercel (plano free)
  useEffect(() => {
    fetchNotificacoes();
    let interval: NodeJS.Timeout;
    
    const startPolling = () => {
      interval = setInterval(fetchNotificacoes, 120000);
    };
    
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchNotificacoes();
        startPolling();
      } else {
        clearInterval(interval);
      }
    };
    
    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchNotificacoes]);

  // Realtime removido: o Supabase Realtime estava causando reconexões WebSocket em loop,
  // sobrecarregando o navegador. O polling a cada 30s (acima) já mantém as notificações atualizadas.
  // Quando o Realtime for habilitado no dashboard do Supabase, pode-se restaurar este useEffect.

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const marcarComoLida = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/notificacoes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
        setNaoLidas((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const marcarTodasComoLidas = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/notificacoes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ todas: true }),
      });

      if (res.ok) {
        setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
        setNaoLidas(0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const excluirNotificacao = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/notificacoes?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const removida = notificacoes.find((n) => n.id === id);
        setNotificacoes((prev) => prev.filter((n) => n.id !== id));
        if (removida && !removida.lida) {
          setNaoLidas((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatarTempo = (data: string) => {
    const agora = new Date();
    const notif = new Date(data);
    const diff = Math.floor((agora.getTime() - notif.getTime()) / 1000);
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão do sininho */}
      <Button
        variant="ghost"
        size="icon"
        title="Notificações"
        className={cn("relative", className)}
        onClick={() => setAberto(!aberto)}
      >
        <Bell className="h-5 w-5 text-current" />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-5 w-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </Button>

      {/* Dropdown */}
      {aberto && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-sm text-slate-800">Notificações</h3>
            {naoLidas > 0 && (
              <button
                onClick={marcarTodasComoLidas}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <ScrollArea className="h-[400px]">
            {notificacoes.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Nenhuma notificação
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notificacoes.map((n) => {
                  const Icone = iconesPorTipo[n.tipo] || Bell;
                  const cor = coresPorTipo[n.tipo] || "bg-slate-100 text-slate-700";
                  return (
                    <div
                      key={n.id}
                      className={`px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                        !n.lida ? "bg-blue-50/50" : ""
                      }`}
                      onClick={() => !n.lida && marcarComoLida(n.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${cor}`}>
                          <Icone className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 break-words">
                            {n.titulo}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 break-words">
                            {n.mensagem}
                          </p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-slate-400">{formatarTempo(n.created_at)}</span>
                            {!n.lida && (
                              <Badge variant="secondary" className="h-4 text-[9px] bg-blue-100 text-blue-700 px-1.5">
                                Nova
                              </Badge>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => excluirNotificacao(n.id, e)}
                          className="text-slate-300 hover:text-red-500 transition-colors shrink-0 mt-0.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Toast flutuante */}
      {toastNotif && (
        <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 fade-in duration-300">
          <div
            className="bg-white rounded-lg shadow-lg border border-slate-200 p-4 w-80 cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => {
              setToastNotif(null);
              setAberto(true);
            }}
          >
            <div className="flex items-start gap-3">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${coresPorTipo[toastNotif.tipo] || "bg-slate-100 text-slate-700"}`}>
                {(() => {
                  const Icone = iconesPorTipo[toastNotif.tipo] || Bell;
                  return <Icone className="h-4 w-4" />;
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{toastNotif.titulo}</p>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{toastNotif.mensagem}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
