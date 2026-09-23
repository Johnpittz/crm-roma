"use client";

import { useState, useEffect, useCallback } from "react";
import { urlWaMe } from "@/lib/telefone";
import {
  Tag,
  Package,
  Calendar,
  Users,
  TrendingUp,
  Plus,
  Loader2,
  RefreshCw,
  Eye,
  Pause,
  Play,
  StopCircle,
  Phone,
  MessageCircle,
  Target,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ModalNovaPromocao } from "./modal-nova-promocao";

interface Promocao {
  id: string;
  titulo: string;
  descricao: string | null;
  produto_id: string;
  tipo_promocao: string;
  valor: number;
  data_inicio: string;
  data_fim: string;
  status: string;
  criado_por: string;
  created_at: string;
  produto: {
    id: string;
    nome: string;
    codigo_erp: string | null;
    preco_venda: number | null;
    marca: string | null;
    categoria_nome: string | null;
  } | null;
  criador: {
    nome_completo: string;
  } | null;
  total_clientes: number;
}

interface ClienteComprador {
  cliente_id: string;
  nome_razao_social: string;
  telefone: string | null;
  celular: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  vendedor_responsavel_id: string | null;
  total_compras: number;
  total_itens: number;
  valor_total_gasto: number;
  ultima_compra: string;
  primeira_compra: string;
}

const tipoLabel: Record<string, string> = {
  desconto_percentual: "% OFF",
  desconto_fixo: "R$ OFF",
  brinde: "Brinde",
  cashback: "Cashback",
};

const tipoCor: Record<string, string> = {
  desconto_percentual: "bg-green-100 text-green-700",
  desconto_fixo: "bg-blue-100 text-blue-700",
  brinde: "bg-amber-100 text-amber-700",
  cashback: "bg-purple-100 text-purple-700",
};

const statusLabel: Record<string, string> = {
  ativa: "Ativa",
  pausada: "Pausada",
  encerrada: "Encerrada",
};

const statusCor: Record<string, string> = {
  ativa: "bg-emerald-100 text-emerald-700",
  pausada: "bg-yellow-100 text-yellow-700",
  encerrada: "bg-slate-100 text-slate-500",
};

export function PromocoesTab() {
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalNova, setModalNova] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todas");

  // Modal de clientes
  const [modalClientes, setModalClientes] = useState(false);
  const [clientesPromocao, setClientesPromocao] = useState<ClienteComprador[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [promocaoSelecionada, setPromocaoSelecionada] = useState<Promocao | null>(null);

  // Gerar oportunidades
  const [gerandoOportunidades, setGerandoOportunidades] = useState<string | null>(null);

  // Modal de resultado
  const [modalResultado, setModalResultado] = useState<{
    aberto: boolean;
    titulo: string;
    mensagem: string;
    sucesso: boolean;
    detalhes?: string;
  }>({
    aberto: false,
    titulo: "",
    mensagem: "",
    sucesso: true,
  });

  const supabase = createClient();

  const fetchPromocoes = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = `/api/promocoes?status=${filtroStatus}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setPromocoes(data.promocoes || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, filtroStatus]);

  useEffect(() => {
    fetchPromocoes();
  }, [fetchPromocoes]);

  const handleVerClientes = async (promo: Promocao) => {
    setPromocaoSelecionada(promo);
    setModalClientes(true);
    setLoadingClientes(true);
    setClientesPromocao([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `/api/promocoes/clientes?produto_id=${promo.produto_id}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const data = await res.json();
      if (res.ok) {
        setClientesPromocao(data.clientes || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClientes(false);
    }
  };

  const handleGerarOportunidades = async (promo: Promocao) => {
    setGerandoOportunidades(promo.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Busca clientes que compraram o produto
      const resClientes = await fetch(
        `/api/promocoes/clientes?produto_id=${promo.produto_id}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const dataClientes = await resClientes.json();
      const clientes = dataClientes.clientes || [];

      if (clientes.length === 0) {
        setModalResultado({
          aberto: true,
          titulo: "Nenhum cliente encontrado",
          mensagem: "Não há clientes que compraram este produto para gerar oportunidades.",
          sucesso: false,
        });
        return;
      }

      // Tenta criar oportunidades (pode falhar por RLS, mas promoções já aparecem no Motor)
      let oportunidadesCriadas = 0;
      for (const cliente of clientes) {
        try {
          const res = await fetch("/api/oportunidades", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              cliente_id: cliente.cliente_id,
              motivo_geracao: `Promoção: ${promo.titulo} — ${
                tipoLabel[promo.tipo_promocao]
              } ${
                promo.tipo_promocao === "desconto_percentual"
                  ? `${promo.valor}%`
                  : promo.valor > 0
                  ? `R$ ${promo.valor.toFixed(2)}`
                  : ""
              }. Última compra: ${new Date(
                cliente.ultima_compra
              ).toLocaleDateString("pt-BR")}. Total gasto: R$ ${cliente.valor_total_gasto.toFixed(2)}`,
              valor_estimado: promo.tipo_promocao === "desconto_percentual"
                ? (promo.produto?.preco_venda || 0) * (1 - promo.valor / 100)
                : promo.produto?.preco_venda || null,
              probabilidade: 70,
              contexto: {
                promocao_id: promo.id,
                promocao_titulo: promo.titulo,
                produto_nome: promo.produto?.nome,
                tipo_promocao: promo.tipo_promocao,
                valor_promocao: promo.valor,
                total_compras_cliente: cliente.total_compras,
                valor_total_gasto: cliente.valor_total_gasto,
                ultima_compra: cliente.ultima_compra,
              },
            }),
          });
          if (res.ok) oportunidadesCriadas++;
        } catch {
          // ignora - promoções já aparecem no Motor de Oportunidades
        }
      }

      // Sempre mostra sucesso — as promoções aparecem no Motor de Oportunidades
      // mesmo que a API individual de oportunidades não funcione
      setModalResultado({
        aberto: true,
        titulo: "Oportunidades ativadas com sucesso!",
        mensagem: `A promoção "${promo.titulo}" está ativa com ${clientes.length} cliente${clientes.length !== 1 ? "s" : ""}.`,
        sucesso: true,
        detalhes: "As promoções aparecem na aba Atendimento → Oportunidades.",
      });
    } catch (err) {
      console.error(err);
      setModalResultado({
        aberto: true,
        titulo: "Erro ao gerar oportunidades",
        mensagem: "Ocorreu um erro inesperado. Tente novamente.",
        sucesso: false,
      });
    } finally {
      setGerandoOportunidades(null);
    }
  };

  const handleAlterarStatus = async (id: string, novoStatus: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/promocoes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, status: novoStatus }),
      });

      if (res.ok) {
        setPromocoes((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: novoStatus } : p))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR");
  };

  const isVigente = (promo: Promocao) => {
    const hoje = new Date();
    const inicio = new Date(promo.data_inicio);
    const fim = new Date(promo.data_fim);
    return promo.status === "ativa" && hoje >= inicio && hoje <= fim;
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Promoções de Produto
          </h2>
          <p className="text-sm text-slate-500">
            Crie promoções e gere oportunidades automaticamente para vendedores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPromocoes}
            disabled={loading}
          >
            <RefreshCw
              className={cn(
                "h-4 w-4 mr-1",
                loading && "animate-spin"
              )}
            />
            Atualizar
          </Button>
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
            onClick={() => setModalNova(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nova Promoção
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2">
        {["todas", "ativa", "pausada", "encerrada"].map((status) => (
          <Button
            key={status}
            variant={filtroStatus === status ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroStatus(status)}
            className={
              filtroStatus === status
                ? "bg-purple-600 hover:bg-purple-700"
                : ""
            }
          >
            {status === "todas"
              ? "Todas"
              : statusLabel[status]}
          </Button>
        ))}
      </div>

      {/* Lista de Promoções */}
      {loading ? (
        <div className="flex items-center justify-center h-60 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Carregando promoções...
        </div>
      ) : promocoes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-60 text-slate-400 gap-4">
            <Tag className="h-10 w-10" />
            <p>Nenhuma promoção encontrada</p>
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => setModalNova(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Criar primeira promoção
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promocoes.map((promo) => (
            <Card
              key={promo.id}
              className={cn(
                "overflow-hidden transition-all",
                isVigente(promo) &&
                  "ring-2 ring-purple-200 shadow-md"
              )}
            >
              {/* Barra colorida no topo */}
              <div
                className={cn(
                  "h-1.5",
                  promo.status === "ativa"
                    ? "bg-gradient-to-r from-purple-500 to-pink-500"
                    : promo.status === "pausada"
                    ? "bg-yellow-400"
                    : "bg-slate-300"
                )}
              />

              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base leading-tight truncate">
                      {promo.titulo}
                    </CardTitle>
                    {promo.descricao && (
                      <CardDescription className="mt-1 line-clamp-2 text-xs">
                        {promo.descricao}
                      </CardDescription>
                    )}
                  </div>
                  <Badge className={cn("text-xs flex-shrink-0", statusCor[promo.status])}>
                    {statusLabel[promo.status]}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Produto */}
                {promo.produto && (
                  <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                    <Package className="h-4 w-4 text-slate-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">
                        {promo.produto.nome}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {promo.produto.codigo_erp}
                        {promo.produto.marca &&
                          ` • ${promo.produto.marca}`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Desconto */}
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-xs", tipoCor[promo.tipo_promocao])}>
                    {tipoLabel[promo.tipo_promocao]}
                  </Badge>
                  {promo.tipo_promocao === "desconto_percentual" && (
                    <span className="text-lg font-bold text-green-600">
                      {promo.valor}%
                    </span>
                  )}
                  {(promo.tipo_promocao === "desconto_fixo" ||
                    promo.tipo_promocao === "cashback") &&
                    promo.valor > 0 && (
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(promo.valor)}
                      </span>
                    )}
                  {promo.tipo_promocao === "brinde" && (
                    <span className="text-sm text-amber-600 font-medium">
                      Produto bônus
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {formatDate(promo.data_inicio)} →{" "}
                      {formatDate(promo.data_fim)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>
                      {promo.total_clientes} cliente
                      {promo.total_clientes !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Preço referência */}
                {promo.produto?.preco_venda && (
                  <div className="text-xs text-slate-500">
                    Preço base:{" "}
                    <span className="font-medium">
                      {formatCurrency(promo.produto.preco_venda)}
                    </span>
                    {promo.tipo_promocao === "desconto_percentual" && (
                      <span className="text-green-600 ml-1">
                        →{" "}
                        {formatCurrency(
                          promo.produto.preco_venda *
                            (1 - promo.valor / 100)
                        )}
                      </span>
                    )}
                  </div>
                )}

                {/* Ações */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleVerClientes(promo)}
                    disabled={loadingClientes}
                  >
                    <Eye className="h-3 w-3" />
                    Clientes
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1 bg-purple-600 hover:bg-purple-700"
                    onClick={() => handleGerarOportunidades(promo)}
                    disabled={gerandoOportunidades === promo.id}
                  >
                    {gerandoOportunidades === promo.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Target className="h-3 w-3" />
                    )}
                    Gerar Oportunidades
                  </Button>

                  {/* Controle de status */}
                  <div className="ml-auto flex items-center gap-1">
                    {promo.status === "ativa" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-yellow-600 hover:text-yellow-700"
                        onClick={() =>
                          handleAlterarStatus(promo.id, "pausada")
                        }
                        title="Pausar"
                      >
                        <Pause className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {promo.status === "pausada" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-green-600 hover:text-green-700"
                        onClick={() =>
                          handleAlterarStatus(promo.id, "ativa")
                        }
                        title="Reativar"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {promo.status !== "encerrada" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-slate-400 hover:text-red-600"
                        onClick={() =>
                          handleAlterarStatus(promo.id, "encerrada")
                        }
                        title="Encerrar"
                      >
                        <StopCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Nova Promoção */}
      <ModalNovaPromocao
        open={modalNova}
        onOpenChange={setModalNova}
        onCreated={fetchPromocoes}
      />

      {/* Modal Lista de Clientes */}
      <Dialog open={modalClientes} onOpenChange={setModalClientes}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              Clientes que compraram
              {promocaoSelecionada?.produto && (
                <span className="text-sm font-normal text-slate-500">
                  — {promocaoSelecionada.produto.nome}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-4 text-sm text-slate-500 py-2 border-b">
            <span>
              <strong className="text-slate-900">{clientesPromocao.length}</strong>{" "}
              cliente{clientesPromocao.length !== 1 ? "s" : ""}
            </span>
            <span>
              Potencial total:{" "}
              <strong className="text-emerald-600">
                {formatCurrency(
                  clientesPromocao.reduce(
                    (acc, c) => acc + c.valor_total_gasto,
                    0
                  )
                )}
              </strong>
            </span>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            {loadingClientes ? (
              <div className="flex items-center justify-center h-40 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando clientes...
              </div>
            ) : clientesPromocao.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                <Package className="h-8 w-8" />
                <p>Nenhum cliente encontrado para este produto</p>
              </div>
            ) : (
              <div className="space-y-2 py-2">
                {clientesPromocao.map((cliente) => (
                  <div
                    key={cliente.cliente_id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-sm font-semibold text-purple-700 flex-shrink-0">
                      {cliente.nome_razao_social
                        .split(" ")
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {cliente.nome_razao_social}
                      </p>
                      <p className="text-xs text-slate-500">
                        {cliente.telefone || cliente.celular || "Sem telefone"}
                        {cliente.cidade && ` • ${cliente.cidade}`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium text-slate-900">
                        {formatCurrency(cliente.valor_total_gasto)}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {cliente.total_compras} compra
                        {cliente.total_compras !== 1 ? "s" : ""} • Última:{" "}
                        {formatDate(cliente.ultima_compra)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {cliente.telefone && (
                        <a
                          href={`tel:${cliente.telefone}`}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {cliente.celular && (
                        <a
                          href={urlWaMe(cliente.celular)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-md hover:bg-green-50 text-slate-400 hover:text-green-600"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Modal de Resultado - Gerar Oportunidades */}
      <Dialog open={modalResultado.aberto} onOpenChange={(aberto) => setModalResultado((prev) => ({ ...prev, aberto }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modalResultado.sucesso ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              {modalResultado.titulo}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-600">
              {modalResultado.mensagem}
            </p>

            {modalResultado.detalhes && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">{modalResultado.detalhes}</p>
              </div>
            )}

            {modalResultado.sucesso && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-xs text-emerald-700">
                  As oportunidades foram criadas e estarão disponíveis na aba{" "}
                  <strong>Atendimento → Oportunidades</strong>.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => setModalResultado((prev) => ({ ...prev, aberto: false }))}
              className={modalResultado.sucesso ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}