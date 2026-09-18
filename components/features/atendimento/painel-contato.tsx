"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Pencil, Phone, Mail, Calendar, FileText, Plus, ChevronDown, ChevronRight, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ETIQUETAS_DISPONIVEIS } from "@/lib/etiquetas";
import { toast } from "sonner";
import { ModalConcluirTarefa } from "./modal-concluir-tarefa";

interface Atendimento {
  id: string;
  telefone_cliente: string;
  nome_cliente: string;
  status: string;
  created_at?: string;
  cliente_id?: string | null;
  clientes?: {
    id: string;
    nome_razao_social: string;
    telefone?: string;
    celular?: string;
    email?: string;
    cpf?: string;
  } | null;
}

interface PainelContatoProps {
  atendimento: Atendimento | null;
  onFechar: () => void;
  onMarcarConcluido?: (id: string) => void;
  onEtiquetaChange?: () => void;
}

interface SecaoProps {
  titulo: string;
  children: React.ReactNode;
  badge?: number;
}

function Secao({ titulo, children, badge }: SecaoProps) {
  const [aberta, setAberta] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        onClick={() => setAberta(!aberta)}
      >
        <span>{titulo}</span>
        <div className="flex items-center gap-2">
          {badge !== undefined && <span className="text-xs text-slate-400">{badge}</span>}
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={(e) => { e.stopPropagation(); setAberta(!aberta); }}>
            <Plus className="h-4 w-4" />
          </Button>
          {aberta ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
        </div>
      </button>
      {aberta && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

export function PainelContato({ atendimento, onFechar, onMarcarConcluido, onEtiquetaChange }: PainelContatoProps) {
  const supabase = useMemo(() => createClient(), []);

  // ── Etiquetas ──
  const [etiquetasBusca, setEtiquetasBusca] = useState("");
  const [etiquetasVinculadas, setEtiquetasVinculadas] = useState<string[]>([]);
  const [loadingEtiquetas, setLoadingEtiquetas] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);

  // ── Formulário Criar Tarefa ──
  const hoje = new Date().toISOString().split("T")[0];
  const [tarefaTitulo, setTarefaTitulo] = useState("");
  const [tarefaTipo, setTarefaTipo] = useState("whatsapp");
  const [tarefaPrioridade, setTarefaPrioridade] = useState("media");
  const [tarefaData, setTarefaData] = useState(hoje);
  const [tarefaHora, setTarefaHora] = useState("");
  const [tarefaColuna, setTarefaColuna] = useState("a_fazer");
  const [salvandoTarefa, setSalvandoTarefa] = useState(false);

  // ── Modal concluir tarefa ──
  const [modalConcluir, setModalConcluir] = useState<{ aberto: boolean; tarefaId: string; titulo: string }>({
    aberto: false, tarefaId: "", titulo: "",
  });
  const [salvandoConclusao, setSalvandoConclusao] = useState(false);

  // ── Tarefas do cliente ──
  interface TarefaCliente {
    id: string;
    titulo: string;
    tipo: string;
    prioridade: string;
    coluna_kanban: string;
    data_inicio: string | null;
    hora_inicio: string | null;
    valor_venda: number | null;
    resultado: string | null;
  }
  const [tarefasCliente, setTarefasCliente] = useState<TarefaCliente[]>([]);

  // ── Dados do atendimento ──
  const nome = atendimento?.clientes?.nome_razao_social || atendimento?.nome_cliente || "Cliente";
  const telefone = atendimento?.clientes?.telefone || atendimento?.clientes?.celular || atendimento?.telefone_cliente || "";
  const email = (atendimento?.clientes as any)?.email || "";
  const cpf = (atendimento?.clientes as any)?.cpf || "";
  const iniciais = nome.substring(0, 2).toUpperCase();
  const statusAberto = atendimento?.status === "aberto";

  // ── Fetch etiquetas ──
  const fetchEtiquetas = useCallback(async () => {
    if (!atendimento) return;
    setLoadingEtiquetas(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/atendimentos/etiquetas?atendimento_id=${atendimento.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEtiquetasVinculadas(data.etiquetas?.map((e: any) => e.etiqueta) || []);
      }
    } catch (err) {
      console.error("Erro ao buscar etiquetas:", err);
    } finally {
      setLoadingEtiquetas(false);
    }
  }, [atendimento?.id, supabase]);

  // ── Fetch tarefas do cliente ──
  const fetchTarefasCliente = useCallback(async () => {
    if (!atendimento) return;
    const nomeCliente = atendimento.clientes?.nome_razao_social || atendimento.nome_cliente;
    if (!nomeCliente) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/tarefas?cliente_nome=${encodeURIComponent(nomeCliente)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTarefasCliente(data.tarefas || []);
      }
    } catch (err) {
      console.error("Erro ao buscar tarefas:", err);
    }
  }, [atendimento?.id, supabase]);

  // ── Reset ao trocar de conversa ──
  useEffect(() => {
    if (atendimento) {
      fetchEtiquetas();
      fetchTarefasCliente();
      setEtiquetasBusca("");
      setTarefaTitulo("");
      setTarefaTipo("whatsapp");
      setTarefaPrioridade("media");
      setTarefaData(new Date().toISOString().split("T")[0]);
      setTarefaHora("");
      setTarefaColuna("a_fazer");
    } else {
      setEtiquetasVinculadas([]);
      setTarefasCliente([]);
    }
  }, [atendimento?.id, fetchEtiquetas, fetchTarefasCliente]);

  // ── Vincular / remover etiqueta ──
  const vincularEtiqueta = async (etiqueta: string) => {
    if (!atendimento) return;
    setSalvando(etiqueta);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/atendimentos/etiquetas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ atendimento_id: atendimento.id, etiqueta }),
      });
      if (res.ok) { setEtiquetasVinculadas((p) => [...p, etiqueta]); onEtiquetaChange?.(); }
    } catch (err) { console.error(err); } finally { setSalvando(null); }
  };

  const removerEtiqueta = async (etiqueta: string) => {
    if (!atendimento) return;
    setSalvando(etiqueta);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/atendimentos/etiquetas?atendimento_id=${atendimento.id}&etiqueta=${encodeURIComponent(etiqueta)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) { setEtiquetasVinculadas((p) => p.filter((e) => e !== etiqueta)); onEtiquetaChange?.(); }
    } catch (err) { console.error(err); } finally { setSalvando(null); }
  };

  // ── Criar tarefa ──
  const criarTarefa = async () => {
    if (!atendimento || !tarefaTitulo.trim()) return;
    setSalvandoTarefa(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          titulo: tarefaTitulo.trim(),
          cliente_nome: nome,
          cliente_id: atendimento.cliente_id || null,
          tipo: tarefaTipo,
          prioridade: tarefaPrioridade,
          data_inicio: tarefaData || null,
          hora_inicio: tarefaHora || null,
          coluna_kanban: tarefaColuna,
          origem_lead: "whatsapp",
        }),
      });
      if (res.ok) {
        const colunasMap: Record<string, string> = { a_fazer: "A Fazer", em_andamento: "Andamento" };
        toast.success("Tarefa criada!", { description: `"${tarefaTitulo.trim()}" → "${colunasMap[tarefaColuna] || tarefaColuna}"` });
        setTarefaTitulo("");
        setTarefaTipo("whatsapp");
        setTarefaPrioridade("media");
        setTarefaData(hoje);
        setTarefaHora("");
        setTarefaColuna("a_fazer");
        fetchTarefasCliente();
      } else {
        const err = await res.json();
        toast.error("Erro ao criar tarefa", { description: err.error || "Tente novamente" });
      }
    } catch (err) { toast.error("Erro ao criar tarefa"); } finally { setSalvandoTarefa(false); }
  };

  // ── Concluir tarefa (abre modal) ──
  const concluirTarefa = (tarefaId: string, titulo: string) => {
    setModalConcluir({ aberto: true, tarefaId, titulo });
  };

  // ── Handler de confirmação do modal ──
  const handleConcluirConfirmar = async (valor: number, observacao: string) => {
    const { tarefaId, titulo } = modalConcluir;
    setSalvandoConclusao(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/tarefas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          id: tarefaId,
          coluna_kanban: "concluida",
          valor_venda: valor,
          resultado: "sucesso",
          data_fim: new Date().toISOString().split("T")[0],
          hora_fim: new Date().toTimeString().slice(0, 5),
        }),
      });
      if (res.ok) {
        toast.success("Venda registrada!", {
          description: `"${titulo}" concluída — R$ ${valor.toLocaleString("pt-BR")}`,
        });
        setModalConcluir({ aberto: false, tarefaId: "", titulo: "" });
        fetchTarefasCliente();
      } else {
        const err = await res.json();
        toast.error("Erro ao concluir", { description: err.error || "Tente novamente" });
      }
    } catch (err) { toast.error("Erro ao concluir tarefa"); }
    finally { setSalvandoConclusao(false); }
  };

  // ── Atualizar tarefa (mudar coluna) ──
  const moverTarefa = async (tarefaId: string, novaColuna: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch("/api/tarefas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: tarefaId, coluna_kanban: novaColuna }),
      });
      toast.success("Tarefa atualizada!");
      fetchTarefasCliente();
    } catch (err) { toast.error("Erro ao atualizar tarefa"); }
  };

  // ── Se nenhum atendimento selecionado ──
  if (!atendimento) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 bg-white border-l border-slate-200">
        <FileText className="h-12 w-12 opacity-20" />
        <p className="text-xs text-center px-4">Selecione uma conversa para ver as informações</p>
      </div>
    );
  }

  const etiquetasFiltradas = ETIQUETAS_DISPONIVEIS.filter(
    (e) => e.toLowerCase().includes(etiquetasBusca.toLowerCase()) && !etiquetasVinculadas.includes(e)
  );
  const iconesTarefa: Record<string, string> = { whatsapp: "💬", ligacao: "📞", email: "📧", visita: "🏢", reuniao: "🤝", follow_up: "🔄", prospeccao: "🔍", outro: "📋" };
  const coresColuna: Record<string, string> = { a_fazer: "bg-slate-100 text-slate-700", em_andamento: "bg-blue-100 text-blue-700", concluida: "bg-emerald-100 text-emerald-700" };
  const nomesColuna: Record<string, string> = { a_fazer: "A Fazer", em_andamento: "Andamento", concluida: "Concluído" };

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200 overflow-y-auto">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-slate-900 truncate">{nome}</h3>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0"><Pencil className="h-3.5 w-3.5 text-slate-500" /></Button>
        </div>
        <p className="text-xs text-slate-500">{telefone}</p>
      </div>

      {/* Avatar */}
      <div className="flex justify-center py-3">
        <div className="h-[72px] w-[72px] rounded-full bg-slate-200 flex items-center justify-center text-2xl font-bold text-slate-500">{iniciais}</div>
      </div>

      {/* Status */}
      <div className="px-4 pb-3 flex items-center gap-3">
        <span className="text-sm text-slate-600">
          Atendimento está{" "}
          <span className={cn("font-semibold", statusAberto ? "text-green-600" : "text-slate-500")}>{statusAberto ? "Aberto" : "Concluído"}</span>
        </span>
        {statusAberto && onMarcarConcluido && (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-green-700 hover:bg-green-50 hover:text-green-800 px-2"
            onClick={() => onMarcarConcluido(atendimento.id)}>
            <Check className="h-3.5 w-3.5" /> Marcar como Concluído
          </Button>
        )}
      </div>

      {/* Dados do contato */}
      <div className="px-4 pb-3 space-y-2">
        <div className="flex items-center gap-3 text-sm"><Phone className="h-4 w-4 text-slate-400 shrink-0" /><span className="text-slate-700">{telefone}</span></div>
        <div className="flex items-center gap-3 text-sm"><Mail className="h-4 w-4 text-slate-400 shrink-0" /><span className={cn(email ? "text-slate-700" : "text-slate-400")}>{email || "E-mail"}</span></div>
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="text-slate-700">{atendimento.created_at ? new Date(atendimento.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Data de inscrição"}</span>
        </div>
        <div className="flex items-center gap-3 text-sm"><FileText className="h-4 w-4 text-slate-400 shrink-0" /><span className={cn(cpf ? "text-slate-700" : "text-slate-400")}>{cpf || "CPF"}</span></div>
      </div>

      <div className="border-t border-slate-200 mt-1">
        {/* Etiquetas */}
        <Secao titulo="Etiquetas" badge={etiquetasVinculadas.length}>
          <div className="space-y-2">
            <Input placeholder="Busca" value={etiquetasBusca} onChange={(e) => setEtiquetasBusca(e.target.value)} className="h-8 text-xs" />
            {etiquetasVinculadas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {etiquetasVinculadas.map((et) => (
                  <Badge key={et} variant="secondary" className={cn("text-[10px] px-2 py-0.5 h-5 bg-blue-100 text-blue-700 cursor-pointer hover:bg-blue-200", salvando === et && "opacity-50")}
                    onClick={() => removerEtiqueta(et)}>
                    {et} <X className="h-2.5 w-2.5 ml-0.5" />
                  </Badge>
                ))}
              </div>
            )}
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {etiquetasFiltradas.map((etiqueta) => (
                <button key={etiqueta} disabled={salvando === etiqueta}
                  className="w-full text-left px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                  onClick={() => vincularEtiqueta(etiqueta)}>
                  {salvando === etiqueta ? "Salvando..." : etiqueta}
                </button>
              ))}
              {etiquetasFiltradas.length === 0 && <p className="text-xs text-slate-400 py-1">{loadingEtiquetas ? "Carregando..." : "Nenhuma etiqueta encontrada"}</p>}
            </div>
          </div>
        </Secao>

        {/* Tarefas do Cliente */}
        <Secao titulo="Tarefas" badge={tarefasCliente.length}>
          {tarefasCliente.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhuma tarefa para este cliente</p>
          ) : (
            <div className="space-y-2">
              {tarefasCliente.map((t) => (
                <div key={t.id} className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-slate-800 truncate">{iconesTarefa[t.tipo] || "📋"} {t.titulo}</p>
                    <Badge variant="secondary" className={cn("text-[9px] px-1.5 py-0 h-4", coresColuna[t.coluna_kanban])}>
                      {nomesColuna[t.coluna_kanban] || t.coluna_kanban}
                    </Badge>
                  </div>
                  {t.valor_venda != null && t.valor_venda > 0 && (
                    <p className="text-[10px] text-emerald-600 font-medium">R$ {t.valor_venda.toLocaleString("pt-BR")}</p>
                  )}
                  {/* Ações rápidas */}
                  {t.coluna_kanban === "a_fazer" && (
                    <div className="flex gap-1 mt-1.5">
                      <button onClick={() => moverTarefa(t.id, "em_andamento")}
                        className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors">▶ Iniciar</button>
                      <button onClick={() => concluirTarefa(t.id, t.titulo)}
                        className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors">✓ Concluir</button>
                    </div>
                  )}
                  {t.coluna_kanban === "em_andamento" && (
                    <div className="flex gap-1 mt-1.5">
                      <button onClick={() => concluirTarefa(t.id, t.titulo)}
                        className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors">✓ Concluir</button>
                      <button onClick={() => moverTarefa(t.id, "a_fazer")}
                        className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors">← Voltar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Secao>

        {/* Criar Tarefa */}
        <Secao titulo="Criar Tarefa">
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Título *</label>
              <Input placeholder="Ex: Follow up proposta" value={tarefaTitulo} onChange={(e) => setTarefaTitulo(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Etapa no Kanban</label>
              <select value={tarefaColuna} onChange={(e) => setTarefaColuna(e.target.value)}
                className="w-full h-8 text-xs mt-1 px-2 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="a_fazer">📋 A Fazer</option>
                <option value="em_andamento">🔄 Andamento</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide">Tipo</label>
                <select value={tarefaTipo} onChange={(e) => setTarefaTipo(e.target.value)}
                  className="w-full h-8 text-xs mt-1 px-2 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="ligacao">📞 Ligação</option>
                  <option value="email">📧 Email</option>
                  <option value="visita">🏢 Visita</option>
                  <option value="reuniao">🤝 Reunião</option>
                  <option value="follow_up">🔄 Follow-up</option>
                  <option value="prospeccao">🔍 Prospecção</option>
                  <option value="outro">📋 Outro</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide">Prioridade</label>
                <select value={tarefaPrioridade} onChange={(e) => setTarefaPrioridade(e.target.value)}
                  className="w-full h-8 text-xs mt-1 px-2 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide">Data</label>
                <Input type="date" value={tarefaData} onChange={(e) => setTarefaData(e.target.value)} className="h-8 text-xs mt-1" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide">Hora</label>
                <Input type="time" value={tarefaHora} onChange={(e) => setTarefaHora(e.target.value)} className="h-8 text-xs mt-1" />
              </div>
            </div>
            <Button size="sm" className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700"
              disabled={!tarefaTitulo.trim() || salvandoTarefa} onClick={criarTarefa}>
              {salvandoTarefa ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              {salvandoTarefa ? "Criando..." : "Criar Tarefa"}
            </Button>
          </div>
        </Secao>
      </div>

      <ModalConcluirTarefa
        aberto={modalConcluir.aberto}
        titulo={modalConcluir.titulo}
        onConfirmar={handleConcluirConfirmar}
        onCancelar={() => setModalConcluir({ aberto: false, tarefaId: "", titulo: "" })}
        salvando={salvandoConclusao}
      />
    </div>
  );
}
