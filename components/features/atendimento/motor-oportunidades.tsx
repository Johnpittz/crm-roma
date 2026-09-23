import { useState, useEffect, useCallback } from "react";
import { urlWaMe } from "@/lib/telefone";
import { Flame, Gift, Link2, TrendingUp, Phone, MessageCircle, X, Eye, Loader2, RefreshCw, Tag, ChevronDown, ChevronUp, Package, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const iconesTipo: Record<string, React.ReactNode> = {
  alerta_churn: <Flame className="h-5 w-5 text-red-500" />,
  promocao_vigente: <Gift className="h-5 w-5 text-purple-500" />,
  afinidade_produtos: <Link2 className="h-5 w-5 text-blue-500" />,
  ciclo_reposicao: <TrendingUp className="h-5 w-5 text-emerald-500" />,
  historico_compras: <TrendingUp className="h-5 w-5 text-blue-500" />,
  recomendacao_ia: <TrendingUp className="h-5 w-5 text-purple-500" />,
  manual: <Gift className="h-5 w-5 text-slate-500" />,
};

const coresTipo: Record<string, string> = {
  alerta_churn: "border-l-red-500 bg-red-50",
  promocao_vigente: "border-l-purple-500 bg-purple-50",
  afinidade_produtos: "border-l-blue-500 bg-blue-50",
  ciclo_reposicao: "border-l-emerald-500 bg-emerald-50",
  historico_compras: "border-l-blue-500 bg-blue-50",
  recomendacao_ia: "border-l-purple-500 bg-purple-50",
  manual: "border-l-slate-500 bg-slate-50",
};

const labelTipo: Record<string, string> = {
  alerta_churn: "🔥 Cliente sem compra",
  promocao_vigente: "🎁 Promoção vigente",
  afinidade_produtos: "🔗 Produto complementar",
  ciclo_reposicao: "📈 Ciclo de reposição",
  historico_compras: "📊 Histórico de compras",
  recomendacao_ia: "🤖 Recomendação",
  manual: "✋ Manual",
};

interface Oportunidade {
  id: string;
  tipo_origem: string;
  motivo_geracao: string;
  clientes: { id: string; nome_razao_social: string; telefone: string | null; celular: string | null } | null;
  contexto: any;
  valor_estimado: number | null;
  probabilidade: number;
  prioridade: string;
  created_at: string;
}

interface PromocaoOportunidade {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo_promocao: string;
  valor: number;
  data_inicio: string;
  data_fim: string;
  produto: { id: string; nome: string; preco_venda: number | null; marca: string | null } | null;
  produto_id: string;
  total_clientes: number;
  clientes?: { cliente_id: string; nome_razao_social: string; telefone: string | null; celular: string | null; total_compras: number; valor_total_gasto: number; ultima_compra: string }[];
}

export function MotorOportunidades() {
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [promocoes, setPromocoes] = useState<PromocaoOportunidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [promoExpandida, setPromoExpandida] = useState<string | null>(null);
  const [clientesPromocao, setClientesPromocao] = useState<Record<string, any[]>>({});
  const [loadingClientes, setLoadingClientes] = useState<string | null>(null);
  const supabase = createClient();

  const fetchOportunidades = useCallback(async (gerarAuto = false) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = gerarAuto
        ? "/api/oportunidades?gerar_auto=true"
        : "/api/oportunidades";

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      if (res.ok) {
        setOportunidades(data.oportunidades || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setGerando(false);
    }
  }, [supabase]);

  // Buscar promoções ativas
  const fetchPromocoes = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/promocoes?status=ativa", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setPromocoes(data.promocoes || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [supabase]);

  useEffect(() => {
    fetchOportunidades();
    fetchPromocoes();
  }, [fetchOportunidades, fetchPromocoes]);

  // Buscar clientes de uma promoção específica
  const handleVerClientesPromo = async (promo: PromocaoOportunidade) => {
    if (promoExpandida === promo.id) {
      setPromoExpandida(null);
      return;
    }
    setPromoExpandida(promo.id);
    if (clientesPromocao[promo.id]) return;

    setLoadingClientes(promo.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/promocoes/clientes?produto_id=${promo.produto_id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setClientesPromocao((prev) => ({ ...prev, [promo.id]: data.clientes || [] }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClientes(null);
    }
  };

  const handleGerarAuto = async () => {
    setGerando(true);
    await fetchOportunidades(true);
  };

  const handleArquivar = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/oportunidades", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, status: "arquivada" }),
      });

      if (res.ok) {
        setOportunidades((prev) => prev.filter((o) => o.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            🎯 Oportunidades
            <Badge className="bg-blue-600 text-xs">{oportunidades.length + promocoes.length}</Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500 gap-1"
            onClick={handleGerarAuto}
            disabled={gerando}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", gerando && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Carregando oportunidades...
          </div>
        ) : (
          <ScrollArea className="h-full px-3">
            <div className="space-y-2">
              {/* Cards de Promoções Ativas */}
              {promocoes.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    Promoções Ativas ({promocoes.length})
                  </p>
                  {promocoes.map((promo) => {
                    const isExpanded = promoExpandida === promo.id;
                    const clientes = clientesPromocao[promo.id] || [];
                    const tipoLabel: Record<string, string> = {
                      desconto_percentual: "% OFF",
                      desconto_fixo: "R$ OFF",
                      brinde: "Brinde",
                      cashback: "Cashback",
                    };

                    return (
                      <div key={promo.id} className="rounded-lg border border-purple-200 bg-purple-50 mb-2 overflow-hidden">
                        {/* Cabeçalho clicável */}
                        <button
                          className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-purple-100 transition-colors text-left"
                          onClick={() => handleVerClientesPromo(promo)}
                        >
                          <Tag className="h-4 w-4 text-purple-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">{promo.titulo}</p>
                            <p className="text-[10px] text-slate-500">
                              {promo.produto?.nome || "Produto"}
                              {promo.valor > 0 && promo.tipo_promocao === "desconto_percentual" && (
                                <> — <span className="text-purple-600 font-semibold">{promo.valor}% OFF</span></>
                              )}
                            </p>
                          </div>
                          <Badge className="bg-purple-100 text-purple-700 text-[10px] flex-shrink-0">
                            {promo.total_clientes} clientes
                          </Badge>
                          {loadingClientes === promo.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500 flex-shrink-0" />
                          ) : isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          )}
                        </button>

                        {/* Lista de clientes expandida */}
                        {isExpanded && (
                          <div className="border-t border-purple-200 bg-white">
                            {loadingClientes === promo.id ? (
                              <div className="px-3 py-4 text-center text-xs text-slate-400">
                                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                                Carregando clientes...
                              </div>
                            ) : clientes.length === 0 ? (
                              <div className="px-3 py-4 text-center text-xs text-slate-400">
                                Nenhum cliente encontrado
                              </div>
                            ) : (
                              <div className="max-h-48 overflow-auto">
                                {clientes.map((cli) => (
                                  <div
                                    key={cli.cliente_id}
                                    className="flex items-center gap-3 px-3 py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50"
                                  >
                                    <div className="h-7 w-7 rounded-full bg-purple-100 flex items-center justify-center text-[10px] font-semibold text-purple-700 flex-shrink-0">
                                      {cli.nome_razao_social?.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[11px] font-medium text-slate-900 truncate">{cli.nome_razao_social}</p>
                                      <p className="text-[10px] text-slate-400">
                                        {cli.total_compras} compra{cli.total_compras !== 1 ? "s" : ""} • {formatCurrency(cli.valor_total_gasto)}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      {(cli.telefone || cli.celular) && (
                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:text-green-600" asChild>
                                          <a
                                            href={urlWaMe(cli.celular || cli.telefone || "")}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          >
                                            <MessageCircle className="h-3 w-3" />
                                          </a>
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Lista de oportunidades */}
              {oportunidades.map((opp) => (
                <div
                  key={opp.id}
                  className={cn(
                    "p-2.5 rounded-lg border-l-4 border shadow-sm bg-white",
                    coresTipo[opp.tipo_origem] || coresTipo.manual
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {iconesTipo[opp.tipo_origem] || iconesTipo.manual}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="font-semibold text-xs text-slate-900 truncate">
                          {labelTipo[opp.tipo_origem] || opp.tipo_origem}
                        </h4>
                        {opp.probabilidade >= 70 && (
                          <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">
                            Alta
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs font-medium text-slate-700">
                        {opp.clientes?.nome_razao_social || "Cliente não identificado"}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                        {opp.motivo_geracao}
                      </p>

                      {opp.contexto?.dias_sem_compra && (
                        <p className="text-[10px] text-slate-500">
                          Sem compra há {opp.contexto.dias_sem_compra} dias
                          {opp.contexto.ultima_compra && ` | Última: ${opp.contexto.ultima_compra}`}
                        </p>
                      )}

                      {opp.valor_estimado && (
                        <p className="text-[10px] font-medium text-emerald-600 mt-0.5">
                          Potencial: {formatCurrency(opp.valor_estimado)}
                        </p>
                      )}

                      {/* Ações */}
                      <div className="flex items-center gap-2 mt-3">
                        <Button size="sm" className="h-7 text-xs gap-1">
                          <Phone className="h-3 w-3" />
                          Ligar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                        >
                          <MessageCircle className="h-3 w-3" />
                          Whats
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1 text-slate-500"
                        >
                          <Eye className="h-3 w-3" />
                          Ver
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 ml-auto text-slate-400 hover:text-slate-600"
                          onClick={() => handleArquivar(opp.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
