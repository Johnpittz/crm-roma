"use client";

import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface ListaAtendimentosLateralProps {
  atendimentos: Atendimento[];
  loading: boolean;
  onRefresh: () => void;
  onAbrirChat: (a: Atendimento) => void;
  etiquetas?: Record<string, string[]>;
  tarefasMap?: Record<string, number>;
}

export function ListaAtendimentosLateral({
  atendimentos,
  loading,
  onRefresh,
  onAbrirChat,
  etiquetas = {},
  tarefasMap = {},
}: ListaAtendimentosLateralProps) {
  const supabase = createClient();

  const handleFechar = async (id: string) => {
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
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const horaAtendimento = (data: string) => {
    return new Date(data).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Carregando...
          </div>
        ) : atendimentos.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Nenhum atendimento
          </div>
        ) : (
          <div className="h-full overflow-y-auto overflow-x-hidden">
            <div className="space-y-1 p-1">
              {atendimentos.map((a) => {
                const isNaoLido = a.nao_lido;
                const hora = a.ultima_mensagem_data
                  ? horaAtendimento(a.ultima_mensagem_data)
                  : "";
                const iniciais = (
                  a.clientes?.nome_razao_social ||
                  a.nome_cliente ||
                  "C"
                )
                  .substring(0, 2)
                  .toUpperCase();
                const nome = a.clientes?.nome_razao_social || a.nome_cliente || "Cliente";
                const temTarefa = (tarefasMap[nome] || 0) > 0;
                const qtdTarefas = tarefasMap[nome] || 0;

                return (
                  <div
                    key={a.id}
                    className={cn(
                      "overflow-hidden rounded-lg cursor-pointer transition-all border border-transparent",
                      isNaoLido
                        ? "bg-green-50 hover:bg-green-100/80 border-green-100"
                        : "bg-white hover:bg-slate-50 border-slate-100"
                    )}
                    onClick={() => onAbrirChat(a)}
                  >
                    <div className="flex gap-2.5 px-3 py-2.5 items-start">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div
                          className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold",
                            isNaoLido
                              ? "bg-green-600 text-white"
                              : "bg-slate-200 text-slate-600"
                          )}
                        >
                          {iniciais}
                        </div>
                        {isNaoLido && (
                          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-red-500 rounded-full border-2 border-white" />
                        )}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-sm font-semibold truncate", isNaoLido ? "text-slate-900" : "text-slate-700")}>
                            {nome}
                          </span>
                          {temTarefa && (
                            <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5 bg-amber-100 text-amber-700 font-medium shrink-0">
                              📋 {qtdTarefas}
                            </Badge>
                          )}
                          <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                            {hora}
                          </span>
                        </div>
                         <p className={cn("text-xs truncate", isNaoLido ? "text-slate-700" : "text-slate-500")}>
                           {a.ultima_mensagem_remetente === "vendedor" ? "Você: " : ""}
                           {a.ultima_mensagem}
                         </p>
                         {/* Badges de etiquetas */}
                         {etiquetas[a.id] && etiquetas[a.id].length > 0 && (
                           <div className="flex flex-wrap gap-1 mt-1">
                             {etiquetas[a.id].slice(0, 3).map((et) => (
                               <Badge
                                 key={et}
                                 variant="secondary"
                                 className="text-[8px] px-1.5 py-0 h-3.5 bg-blue-100 text-blue-700 font-medium"
                               >
                                 {et}
                               </Badge>
                             ))}
                             {etiquetas[a.id].length > 3 && (
                               <span className="text-[8px] text-slate-400">+{etiquetas[a.id].length - 3}</span>
                             )}
                           </div>
                         )}
                         <span className="text-[10px] text-slate-400 block">
                           {a.telefone_cliente}
                         </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
  </div>
        )}
      </div>
    </div>
  );
}