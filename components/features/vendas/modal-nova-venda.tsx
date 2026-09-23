"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

interface Cliente {
  id: string;
  nome_razao_social: string;
}

interface Produto {
  id: string;
  nome: string;
  preco_venda: number;
}

interface ItemVenda {
  produto_id: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

interface ModalNovaVendaProps {
  onSuccess?: () => void;
}

export function ModalNovaVenda({ onSuccess }: ModalNovaVendaProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(false);

  const [form, setForm] = useState({
    cliente_id: "",
    data_venda: new Date().toISOString().split("T")[0],
    status: "confirmada",
    forma_pagamento: "",
    prazo_pagamento: "",
  });

  const [itens, setItens] = useState<ItemVenda[]>([
    { produto_id: "", quantidade: 1, valor_unitario: 0, valor_total: 0 },
  ]);

  const supabase = createClient();

  // Busca clientes e produtos ao abrir o modal
  useEffect(() => {
    if (!open) return;

    const fetchDados = async () => {
      setCarregandoDados(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Busca clientes da carteira do logado (escopo aplicado no servidor)
      const resClientes = await fetch("/api/clientes?limite=1000", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const clientesJson = resClientes.ok ? await resClientes.json() : { clientes: [] };

      // Busca produtos
      const { data: produtosData } = await supabase
        .from("produtos")
        .select("id, nome, preco_venda")
        .order("nome");

      setClientes(clientesJson.clientes || []);
      setProdutos(produtosData || []);
      setCarregandoDados(false);
    };

    fetchDados();
  }, [open]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const novosItens = [...itens];
    novosItens[index] = { ...novosItens[index], [field]: value };

    // Se mudou o produto, atualiza o valor unitário
    if (field === "produto_id") {
      const produto = produtos.find((p) => p.id === value);
      if (produto) {
        novosItens[index].valor_unitario = produto.preco_venda;
      }
    }

    // Recalcula o valor total do item
    novosItens[index].valor_total = novosItens[index].quantidade * novosItens[index].valor_unitario;

    setItens(novosItens);
  };

  const addItem = () => {
    setItens([...itens, { produto_id: "", quantidade: 1, valor_unitario: 0, valor_total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (itens.length === 1) return;
    setItens(itens.filter((_, i) => i !== index));
  };

  const valorTotal = itens.reduce((acc, item) => acc + item.valor_total, 0);
  const valorFinal = valorTotal; // Simplificado (sem desconto/frete por enquanto)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!form.cliente_id) {
      setError("Selecione um cliente");
      setLoading(false);
      return;
    }

    const itensValidos = itens.filter((i) => i.produto_id && i.quantidade > 0);
    if (itensValidos.length === 0) {
      setError("Adicione pelo menos um produto");
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Sessão expirada");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/vendas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          cliente_id: form.cliente_id,
          data_venda: form.data_venda,
          valor_total: valorTotal,
          valor_final: valorFinal,
          status: form.status,
          forma_pagamento: form.forma_pagamento || null,
          prazo_pagamento: form.prazo_pagamento ? parseInt(form.prazo_pagamento) : null,
          itens: itensValidos.map((item) => ({
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            valor_total: item.valor_total,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao criar venda");
        setLoading(false);
        return;
      }

      setOpen(false);
      setForm({
        cliente_id: "",
        data_venda: new Date().toISOString().split("T")[0],
        status: "confirmada",
        forma_pagamento: "",
        prazo_pagamento: "",
      });
      setItens([{ produto_id: "", quantidade: 1, valor_unitario: 0, valor_total: 0 }]);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nova Venda
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Venda</DialogTitle>
          <DialogDescription>
            Cadastre uma nova venda para o cliente selecionado.
          </DialogDescription>
        </DialogHeader>

        {carregandoDados ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Cliente e Data */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cliente">Cliente *</Label>
                <Select value={form.cliente_id} onValueChange={(v) => handleChange("cliente_id", v)}>
                  <SelectTrigger id="cliente">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome_razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="data">Data da Venda *</Label>
                <Input
                  id="data"
                  type="date"
                  value={form.data_venda}
                  onChange={(e) => handleChange("data_venda", e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Status e Pagamento */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(v) => handleChange("status", v)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="orcamento">Orçamento</SelectItem>
                    <SelectItem value="confirmada">Confirmada</SelectItem>
                    <SelectItem value="faturada">Faturada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pagamento">Forma de Pagamento</Label>
                <Input
                  id="pagamento"
                  placeholder="Ex: Boleto"
                  value={form.forma_pagamento}
                  onChange={(e) => handleChange("forma_pagamento", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prazo">Prazo (dias)</Label>
                <Input
                  id="prazo"
                  type="number"
                  placeholder="30"
                  value={form.prazo_pagamento}
                  onChange={(e) => handleChange("prazo_pagamento", e.target.value)}
                />
              </div>
            </div>

            {/* Itens */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Produtos *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar
                </Button>
              </div>

              <div className="space-y-2">
                {itens.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                    <div className="flex-1">
                      <Select
                        value={item.produto_id}
                        onValueChange={(v) => handleItemChange(index, "produto_id", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o produto" />
                        </SelectTrigger>
                        <SelectContent>
                          {produtos.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome} — {formatCurrency(p.preco_venda)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantidade}
                        onChange={(e) => handleItemChange(index, "quantidade", parseInt(e.target.value) || 1)}
                        placeholder="Qtd"
                      />
                    </div>
                    <div className="w-32 text-right text-sm font-medium">
                      {formatCurrency(item.valor_total)}
                    </div>
                    {itens.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <span className="text-lg font-medium">Valor Total</span>
              <span className="text-2xl font-bold text-emerald-600">{formatCurrency(valorTotal)}</span>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Venda
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
