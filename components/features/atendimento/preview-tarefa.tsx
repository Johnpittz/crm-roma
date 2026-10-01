"use client";

/**
 * Prévia do card no KANBAN (aba "Kanban" / lista de tarefas).
 *
 * O card tem espaço de sobra, então a prévia mostra tudo que a tarefa já
 * sabe — prioridade, título + origem, cliente + telefone, data, hora, valor
 * da venda, descrição e resultado — sempre com linha condicional: campo
 * vazio não vira linha vazia na tela.
 *
 * Extraído do `kanban-tarefas.tsx` de propósito: o Draggable fica lá (drag,
 * click e handlers) e este pedaço é puro JSX testável com Testing Library.
 */

import {
  AlertCircle,
  Calendar,
  Clock,
  Coins,
  MoreHorizontal,
  Phone,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TarefaKanban {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  prioridade: string;
  status: string;
  data_inicio: string | null;
  hora_inicio: string | null;
  data_fim: string | null;
  hora_fim: string | null;
  resultado: string | null;
  observacao_resultado: string | null;
  valor_venda: number | null;
  cliente_nome: string | null;
  coluna_kanban: string;
  ordem: number;
  origem_lead: string | null;
  created_at: string;
  clientes: {
    id: string;
    nome_razao_social: string;
    telefone?: string | null;
    celular?: string | null;
  } | null;
}

const iconesTarefa: Record<string, string> = {
  visita: "🏢",
  ligacao: "📞",
  whatsapp: "💬",
  email: "📧",
  reuniao: "🤝",
  follow_up: "🔄",
  prospeccao: "🔍",
  outro: "📋",
};

const coresPrioridade: Record<string, string> = {
  baixa: "bg-slate-100 text-slate-700",
  media: "bg-blue-100 text-blue-700",
  alta: "bg-orange-100 text-orange-700",
  urgente: "bg-red-100 text-red-700",
};

const origemConfig: Record<string, { icone: string; nome: string; cor: string }> = {
  prospeccao_b2b: { icone: "🔍", nome: "Prospecção", cor: "bg-emerald-100 text-emerald-700" },
  whatsapp: { icone: "💬", nome: "WhatsApp", cor: "bg-green-100 text-green-700" },
  indicacao: { icone: "🤝", nome: "Indicação", cor: "bg-purple-100 text-purple-700" },
  site: { icone: "🌐", nome: "Site", cor: "bg-blue-100 text-blue-700" },
  pixel: { icone: "📊", nome: "Pixel", cor: "bg-orange-100 text-orange-700" },
  api: { icone: "🔗", nome: "API", cor: "bg-cyan-100 text-cyan-700" },
  importacao: { icone: "📁", nome: "Importação", cor: "bg-slate-100 text-slate-600" },
  manual: { icone: "✋", nome: "Manual", cor: "bg-slate-100 text-slate-500" },
};

const resultadosConfig: Record<string, { rotulo: string; cor: string }> = {
  sucesso: { rotulo: "✅ Sucesso", cor: "bg-emerald-100 text-emerald-700" },
  insucesso: { rotulo: "❌ Insucesso", cor: "bg-red-100 text-red-700" },
  remarcado: { rotulo: "📅 Remarcado", cor: "bg-amber-100 text-amber-700" },
  sem_contato: { rotulo: "📞 Sem contato", cor: "bg-slate-100 text-slate-600" },
  follow_up_necessario: { rotulo: "🔄 Follow-up", cor: "bg-blue-100 text-blue-700" },
};

/** `2026-10-05` → `05/10/2026` (aceita ISO com hora, usa só a parte da data). */
export function formatarData(valor: string | null): string {
  if (!valor) return "";
  const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}

/** `14:30:00` → `14:30`. */
export function formatarHora(valor: string | null): string {
  if (!valor) return "";
  return valor.substring(0, 5);
}

/**
 * Telefone vindo do banco (que pode estar solto ou formatado) → padrão BR.
 * Formato que não bate com 10/11 dígitos volta como está, sem inventar.
 */
export function formatarTelefone(valor: string | null): string {
  if (!valor) return "";
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length < 10) return valor;
  const nucleo = digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
  if (nucleo.length === 10) return `(${nucleo.slice(0, 2)}) ${nucleo.slice(2, 6)}-${nucleo.slice(6)}`;
  if (nucleo.length === 11) return `(${nucleo.slice(0, 2)}) ${nucleo.slice(2, 7)}-${nucleo.slice(7)}`;
  return valor;
}

function formatarValor(valor: number): string {
  // o Intl do pt-BR separa "R$" do número com espaço não separável (U+00A0):
  // normaliza para espaço comum, senão o texto não bate em busca/limpeza de dado
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(valor)
    .replace(/\u00A0/g, " ");
}

interface PreviewTarefaProps {
  tarefa: TarefaKanban;
  onExcluir?: (id: string) => void;
}

export function PreviewTarefa({ tarefa, onExcluir }: PreviewTarefaProps) {
  const cliente = tarefa.clientes?.nome_razao_social || tarefa.cliente_nome || "—";
  const telefone = tarefa.clientes?.celular || tarefa.clientes?.telefone || null;
  const data = tarefa.data_inicio || tarefa.data_fim;
  const hora = tarefa.hora_inicio || tarefa.hora_fim;
  const vendida = typeof tarefa.valor_venda === "number" && tarefa.valor_venda > 0;
  const resultado = tarefa.resultado ? resultadosConfig[tarefa.resultado] : null;
  const origem = tarefa.origem_lead ? origemConfig[tarefa.origem_lead] : null;
  const temQuandoHora = Boolean(data || hora || vendida);

  return (
    <div>
      {/* prioridade + ações (aparecem no hover) */}
      <div className="flex items-start justify-between mb-1">
        <Badge
          variant="secondary"
          className={cn(
            "text-[10px] px-1.5 py-0.5",
            coresPrioridade[tarefa.prioridade] || coresPrioridade.media
          )}
        >
          {tarefa.prioridade === "urgente" && <AlertCircle className="h-3 w-3 mr-1" />}
          {tarefa.prioridade}
        </Badge>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onExcluir && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Excluir tarefa"
              className="h-6 w-6 text-slate-400 hover:text-red-500"
              onClick={(e) => {
                e.stopPropagation();
                onExcluir(tarefa.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Mais opções"
            className="h-6 w-6"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4 text-slate-400" />
          </Button>
        </div>
      </div>

      {/* título + origem */}
      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
        <p className="font-medium text-slate-900 text-xs truncate">
          {iconesTarefa[tarefa.tipo] || "📋"} {tarefa.titulo}
        </p>
        {origem && (
          <Badge
            variant="secondary"
            className={cn("text-[9px] px-1.5 py-0 flex-shrink-0", origem.cor)}
          >
            {origem.icone} {origem.nome}
          </Badge>
        )}
      </div>

      {/* cliente + telefone do WhatsApp/cadastro */}
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
        <span className="truncate">{cliente}</span>
        {telefone && (
          <span className="flex items-center gap-1 shrink-0 text-[11px] text-slate-400">
            <Phone className="h-3 w-3" />
            {formatarTelefone(telefone)}
          </span>
        )}
      </div>

      {/* data · hora ............ valor da venda */}
      {temQuandoHora && (
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 mb-1">
          <span className="flex items-center gap-1 min-w-0">
            {data && (
              <>
                <Calendar className="h-3 w-3 shrink-0 text-slate-400" />
                <span className="truncate">{formatarData(data)}</span>
              </>
            )}
            {data && hora && <span className="text-slate-300">·</span>}
            {hora && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0 text-slate-400" />
                {formatarHora(hora)}
              </span>
            )}
          </span>
          {vendida && (
            <span className="flex items-center gap-1 shrink-0 font-semibold text-emerald-600">
              <Coins className="h-3 w-3" />
              {formatarValor(tarefa.valor_venda as number)}
            </span>
          )}
        </div>
      )}

      {/* descrição (limitada a 2 linhas: não estoura o card) */}
      {tarefa.descricao && (
        <p className="text-[11px] text-slate-400 line-clamp-2 mb-1">{tarefa.descricao}</p>
      )}

      {/* resultado + observação */}
      {resultado && (
        <div className="flex items-center gap-1.5 mt-1">
          <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 shrink-0", resultado.cor)}>
            {resultado.rotulo}
          </Badge>
          {tarefa.observacao_resultado && (
            <span className="text-[10px] text-slate-400 truncate" title={tarefa.observacao_resultado}>
              {tarefa.observacao_resultado}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
