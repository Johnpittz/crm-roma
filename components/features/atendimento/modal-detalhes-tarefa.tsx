"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Clock,
  CheckCircle2,
  Trash2,
  ArrowRight,
  AlertCircle,
  Save,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface TarefaCompleta {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  prioridade: string;
  status: string;
  coluna_kanban: string;
  data_inicio: string | null;
  hora_inicio: string | null;
  data_fim: string | null;
  hora_fim: string | null;
  resultado: string | null;
  observacao_resultado: string | null;
  valor_venda: number | null;
  cliente_nome: string | null;
  clientes: { id: string; nome_razao_social: string } | null;
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

const labelsTipo: Record<string, string> = {
  visita: "Visita",
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  reuniao: "Reunião",
  follow_up: "Follow-up",
  prospeccao: "Prospecção",
  outro: "Outro",
};

const labelsResultado: Record<string, { label: string; cor: string }> = {
  sucesso: { label: "✅ Sucesso", cor: "bg-emerald-100 text-emerald-700" },
  insucesso: { label: "❌ Insucesso", cor: "bg-red-100 text-red-700" },
  remarcado: { label: "📅 Remarcado", cor: "bg-blue-100 text-blue-700" },
  sem_contato: { label: "📞 Sem contato", cor: "bg-amber-100 text-amber-700" },
  follow_up_necessario: { label: "🔄 Follow-up", cor: "bg-purple-100 text-purple-700" },
};

const coresPrioridade: Record<string, string> = {
  baixa: "bg-slate-100 text-slate-700",
  media: "bg-blue-100 text-blue-700",
  alta: "bg-orange-100 text-orange-700",
  urgente: "bg-red-100 text-red-700",
};

const opcoesObservacao: Record<string, string[]> = {
  sucesso: ["Venda fechada", "Orçamento enviado", "Reunião agendada", "Parceria firmada"],
  insucesso: ["Sem interesse", "Preço elevado", "Escolheu concorrente", "Não é público-alvo"],
  remarcado: ["Cliente pediu retorno", "Agenda lotada", "Aguardando decisão"],
  sem_contato: ["Não atendeu", "Número inválido", "Sem WhatsApp", "Caixa postal"],
  follow_up_necessario: ["Enviar orçamento", "Confirmar reunião", "Verificar disponibilidade", "Aguardando retorno"],
};

interface ModalDetalhesTarefaProps {
  tarefa: TarefaCompleta | null;
  aberto: boolean;
  onClose: () => void;
  onAtualizar: () => void;
  iniciarConcluindo?: boolean;
}

export function ModalDetalhesTarefa({
  tarefa,
  aberto,
  onClose,
  onAtualizar,
  iniciarConcluindo = false,
}: ModalDetalhesTarefaProps) {
  const [editando, setEditando] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const supabase = createClient();

  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    prioridade: "media",
    valorVenda: "" as string,
  });

  const [resultadoForm, setResultadoForm] = useState({
    resultado: "" as string,
    observacao: "" as string,
    valorVenda: "" as string,
  });

  // Quando abre no modo conclusão, inicializa form
  useEffect(() => {
    if (aberto && iniciarConcluindo && tarefa && tarefa.coluna_kanban !== "concluida") {
      setConcluindo(true);
      setEditando(false);
      setForm({
        titulo: tarefa.titulo,
        descricao: tarefa.descricao || "",
        prioridade: tarefa.prioridade,
        valorVenda: "",
      });
      setResultadoForm({ resultado: "", observacao: "", valorVenda: "" });
    } else if (aberto && tarefa && !iniciarConcluindo) {
      // Inicializa form com dados da tarefa
      const valorFormatado = tarefa.valor_venda
        ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(tarefa.valor_venda)
        : "";
      setForm({
        titulo: tarefa.titulo,
        descricao: tarefa.descricao || "",
        prioridade: tarefa.prioridade,
        valorVenda: valorFormatado,
      });
    } else if (!aberto) {
      setConcluindo(false);
      setEditando(false);
      setResultadoForm({ resultado: "", observacao: "", valorVenda: "" });
    }
  }, [aberto, iniciarConcluindo, tarefa]);

  const handleSalvarEdicao = async () => {
    if (!tarefa) return;
    setSalvando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const body: any = {
        id: tarefa.id,
        titulo: form.titulo,
        descricao: form.descricao,
        prioridade: form.prioridade,
      };

      if (tarefa.resultado === "sucesso" && form.valorVenda) {
        body.valor_venda = parseFloat(form.valorVenda.replace(/\./g, "").replace(",", "."));
      }

      const res = await fetch("/api/tarefas", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setEditando(false);
        onAtualizar();
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  const handleMover = async (coluna: string) => {
    if (!tarefa) return;

    if (coluna === "concluida") {
      setConcluindo(true);
      setForm({
        titulo: tarefa.titulo,
        descricao: tarefa.descricao || "",
        prioridade: tarefa.prioridade,
        valorVenda: "",
      });
      setResultadoForm({ resultado: "", observacao: "", valorVenda: "" });
      return;
    }

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
          id: tarefa.id,
          coluna_kanban: coluna,
          status: coluna === "em_andamento" ? "em_andamento" : "pendente",
        }),
      });
      onAtualizar();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmarConclusao = async () => {
    if (!tarefa) return;
    if (!resultadoForm.resultado) return;
    if (!resultadoForm.observacao) return;
    if (resultadoForm.resultado === "sucesso" && !resultadoForm.valorVenda) return;

    setSalvando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const body: any = {
        id: tarefa.id,
        coluna_kanban: "concluida",
        status: "concluida",
        titulo: form.titulo,
        descricao: form.descricao,
        prioridade: form.prioridade,
        resultado: resultadoForm.resultado,
        observacao_resultado: resultadoForm.observacao,
      };

      if (resultadoForm.resultado === "sucesso" && resultadoForm.valorVenda) {
        body.valor_venda = parseFloat(resultadoForm.valorVenda.replace(/\./g, "").replace(",", "."));
      }

      await fetch("/api/tarefas", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      setConcluindo(false);
      onAtualizar();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!tarefa) return;
    if (!confirm("Excluir esta tarefa?")) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/tarefas?id=${tarefa.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        onAtualizar();
        onClose();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatData = (data: string | null) => {
    if (!data) return "—";
    return new Date(data).toLocaleDateString("pt-BR");
  };

  if (!tarefa) return null;

  const isConcluida = tarefa.coluna_kanban === "concluida";
  const isAndamento = tarefa.coluna_kanban === "em_andamento";
  const podeEditar = isConcluida;
  const podeConcluir = isAndamento;

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="text-xl">{iconesTarefa[tarefa.tipo] || "📋"}</span>
            {(editando || concluindo) ? (
              <Input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                className="font-semibold text-lg h-9"
              />
            ) : (
              <DialogTitle className="text-lg">{tarefa.titulo}</DialogTitle>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Metadados */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className={cn(coresPrioridade[tarefa.prioridade] || coresPrioridade.media)}>
              {tarefa.prioridade === "urgente" && <AlertCircle className="h-3 w-3 mr-1" />}
              {(editando || concluindo) ? form.prioridade : tarefa.prioridade}
            </Badge>
            <Badge variant="outline" className="text-xs">{labelsTipo[tarefa.tipo] || tarefa.tipo}</Badge>
            <Badge variant="secondary" className={cn(
              isConcluida ? "bg-emerald-100 text-emerald-700" : isAndamento ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
            )}>
              {isConcluida ? "Concluído" : isAndamento ? "Andamento" : "A Fazer"}
            </Badge>
          </div>

          {/* Cliente */}
          {(tarefa.clientes?.nome_razao_social || tarefa.cliente_nome) && (
            <div className="text-sm">
              <span className="text-slate-500">Cliente:</span>{" "}
              <span className="font-medium">{tarefa.clientes?.nome_razao_social || tarefa.cliente_nome}</span>
            </div>
          )}

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Início</span>
              <span className="font-medium">{formatData(tarefa.data_inicio)}</span>
            </div>
            <div>
              <span className="text-slate-500 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Prazo</span>
              <span className="font-medium">{formatData(tarefa.data_fim)}</span>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <Label className="text-xs text-slate-500">Descrição</Label>
            {(editando || concluindo) ? (
              <textarea
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            ) : (
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{tarefa.descricao || "Sem descrição"}</p>
            )}
          </div>

          {/* Resultado (só mostra se tiver sido concluída com resultado) */}
          {tarefa.resultado && !concluindo && (
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <Label className="text-xs text-slate-500">Resultado da execução</Label>
              <div className="flex items-center gap-2 mt-1 mb-2">
                <Badge variant="secondary" className={cn(labelsResultado[tarefa.resultado]?.cor || "bg-slate-100 text-slate-700")}>
                  {labelsResultado[tarefa.resultado]?.label || tarefa.resultado}
                </Badge>
              </div>
              {tarefa.observacao_resultado && (
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{tarefa.observacao_resultado}</p>
              )}
              {tarefa.valor_venda && (
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <span className="text-xs text-slate-500">Valor da Venda:</span>
                  <span className="ml-2 text-sm font-bold text-emerald-700">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(tarefa.valor_venda)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Campo valor editável no modo edição (concluída com sucesso) */}
          {editando && tarefa.resultado === "sucesso" && (
            <div>
              <Label className="text-xs">Valor da Venda (R$)</Label>
              <Input
                type="text"
                placeholder="0,00"
                value={form.valorVenda}
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, "");
                  if (v.length > 2) {
                    v = v.replace(/(\d{2})$/, ",$1");
                    v = v.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                  }
                  setForm((f) => ({ ...f, valorVenda: v }));
                }}
                className="mt-1"
              />
            </div>
          )}

          {/* Formulário de conclusão (título/desc/prioridade já editáveis acima) */}
          {concluindo && (
            <div className="space-y-3 border-t pt-3 bg-slate-50 -mx-6 px-6 pb-3">
              <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Registrar resultado da tarefa
              </h4>

              {/* Prioridade */}
              <div>
                <Label className="text-xs">Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => setForm((f) => ({ ...f, prioridade: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Resultado */}
              <div>
                <Label className="text-xs">Resultado *</Label>
                <Select value={resultadoForm.resultado} onValueChange={(v) => setResultadoForm((f) => ({ ...f, resultado: v, observacao: "" }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sucesso">✅ Sucesso — contato/negociação realizada</SelectItem>
                    <SelectItem value="insucesso">❌ Insucesso — não houve interesse</SelectItem>
                    <SelectItem value="remarcado">📅 Remarcado — agendado para outro dia</SelectItem>
                    <SelectItem value="sem_contato">📞 Sem contato — não atendeu</SelectItem>
                    <SelectItem value="follow_up_necessario">🔄 Follow-up necessário</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Observação do resultado */}
              <div>
                <Label className="text-xs">Observação do resultado *</Label>
                <Select
                  value={resultadoForm.observacao}
                  onValueChange={(v) => setResultadoForm((f) => ({ ...f, observacao: v }))}
                  disabled={!resultadoForm.resultado}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={resultadoForm.resultado ? "Selecione..." : "Selecione o resultado primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(opcoesObservacao[resultadoForm.resultado] || []).map((opcao) => (
                      <SelectItem key={opcao} value={opcao}>{opcao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Valor da venda (só se Sucesso) */}
              {resultadoForm.resultado === "sucesso" && (
                <div>
                  <Label className="text-xs">Valor da Venda (R$) *</Label>
                  <Input
                    type="text"
                    placeholder="0,00"
                    value={resultadoForm.valorVenda}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, "");
                      if (v.length > 2) {
                        v = v.replace(/(\d{2})$/, ",$1");
                        v = v.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                      }
                      setResultadoForm((f) => ({ ...f, valorVenda: v }));
                    }}
                    className="mt-1"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleConfirmarConclusao}
                  disabled={
                    salvando || !resultadoForm.resultado || !resultadoForm.observacao ||
                    (resultadoForm.resultado === "sucesso" && !resultadoForm.valorVenda)
                  }
                  className="gap-1"
                >
                  <Check className="h-4 w-4" />
                  {salvando ? "Salvando..." : "Confirmar conclusão"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setConcluindo(false);
                    setResultadoForm({ resultado: "", observacao: "", valorVenda: "" });
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Ações */}
          {!concluindo && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              {editando ? (
                <>
                  <Button size="sm" onClick={handleSalvarEdicao} disabled={salvando} className="gap-1">
                    <Save className="h-4 w-4" />
                    {salvando ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditando(false);
                    // Restaura form original
                    const valorFormatado = tarefa.valor_venda
                      ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(tarefa.valor_venda) : "";
                    setForm({ titulo: tarefa.titulo, descricao: tarefa.descricao || "", prioridade: tarefa.prioridade, valorVenda: valorFormatado });
                  }}>
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  {/* Botão Editar: só aparece quando concluída */}
                  {podeEditar && (
                    <Button size="sm" variant="outline" onClick={() => setEditando(true)}>
                      ✏️ Editar
                    </Button>
                  )}

                  {/* Botão Andamento: aparece quando não está em andamento e não está concluída */}
                  {!isAndamento && !isConcluida && (
                    <Button size="sm" variant="outline" onClick={() => handleMover("em_andamento")}>
                      <ArrowRight className="h-4 w-4 mr-1" />
                      Andamento
                    </Button>
                  )}

                  {/* Botão Concluir: só aparece quando em andamento */}
                  {podeConcluir && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMover("concluida")}
                      className="text-emerald-600 hover:text-emerald-700"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Concluir
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleExcluir}
                    className="text-red-500 hover:text-red-600 ml-auto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}