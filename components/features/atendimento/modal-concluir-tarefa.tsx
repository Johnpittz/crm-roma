"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface ModalConcluirTarefaProps {
  aberto: boolean;
  titulo: string;
  onConfirmar: (valor: number, observacao: string) => void;
  onCancelar: () => void;
  salvando: boolean;
}

export function ModalConcluirTarefa({
  aberto,
  titulo,
  onConfirmar,
  onCancelar,
  salvando,
}: ModalConcluirTarefaProps) {
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");

  const handleConfirmar = () => {
    const valorNum = parseFloat(valor.replace(",", "."));
    if (!valorNum || valorNum <= 0) return;
    onConfirmar(valorNum, observacao);
    setValor("");
    setObservacao("");
  };

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onCancelar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>✓ Concluir Tarefa</DialogTitle>
          <DialogDescription className="truncate">{titulo}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-slate-600">Valor da Venda (R$) *</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Observação</label>
            <textarea
              placeholder="Detalhes do fechamento..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={!valor || parseFloat(valor.replace(",", ".")) <= 0 || salvando}
            onClick={handleConfirmar}
          >
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            {salvando ? "Salvando..." : "✓ Concluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
