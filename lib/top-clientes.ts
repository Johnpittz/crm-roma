/**
 * TOP 20 CLIENTES (os que mais compraram) — regra do card de Atendimento.
 *
 *  - Ranking por VALOR TOTAL COMPRADO (desempate por nº de pedidos), dentro
 *    do escopo de carteira de quem olha (mesma régua de lib/carteira.ts).
 *  - REGRA: quem aparece no Top 20 NÃO aparece na listagem CLIENTES ao lado —
 *    o card manda `excluir_top20=1` para GET /api/clientes, que aplica o mesmo
 *    corte aqui.
 *
 * Fonte: tabela `vendas` (cliente_id + valor_final/valor_total), sincronizada
 * do Millennium. Sem histórico de vendas o ranking volta vazio — o card mostra
 * o aviso, nunca dado inventado.
 */

import type { EscopoCarteira } from "./carteira";

/** Tamanho do ranking. */
export const TOP_CLIENTES_LIMITE = 20;

/** Teto de linhas de `vendas` lidas por cálculo (proteção contra base gigante). */
const MAX_LINHAS_VENDAS = 20_000;
/** Páginas de 1.000 linhas (limite padrão do PostgREST). */
const PAGINA = 1000;
/** Cache em memória por instância (o card do atendimento chama 2x por tela). */
const CACHE_TTL_MS = 2 * 60_000;

export interface TopCliente {
  id: string;
  nome: string;
  documento: string | null;
  pedidos: number;
  valor: number; // em reais
}

/** Uma linha de `vendas` (só as colunas que interessam ao ranking). */
export interface VendaRankingLinha {
  cliente_id: string | null;
  valor_final?: number | null;
  valor_total?: number | null;
  status?: string | null;
}

/** Linha de `clientes` usada para rotular o ranking. */
export interface ClienteRanking {
  id: string;
  nome_razao_social?: string | null;
  cpf_cnpj?: string | null;
}

/** O que um cliente comprou, segundo as linhas de `vendas` informadas. */
export interface AgregadoCliente {
  pedidos: number;
  valor: number;
}

/**
 * Agrega vendas por cliente: nº de pedidos + valor comprado.
 * Regras: sem cliente vinculado não conta; venda cancelada não conta;
 * valor = valor_final, caindo para valor_total quando o final vem zerado.
 */
export function agregarVendasPorCliente(
  linhas: VendaRankingLinha[]
): Map<string, AgregadoCliente> {
  const agregado = new Map<string, AgregadoCliente>();

  for (const linha of linhas || []) {
    if (!linha?.cliente_id) continue;
    if ((linha.status || "").toLowerCase() === "cancelada") continue;

    const valor = Number(linha.valor_final) || Number(linha.valor_total) || 0;
    const atual = agregado.get(linha.cliente_id) || { pedidos: 0, valor: 0 };
    atual.pedidos += 1;
    atual.valor += valor;
    agregado.set(linha.cliente_id, atual);
  }

  return agregado;
}

/**
 * Ids na ordem do ranking: valor comprado ↓, empate por nº de pedidos ↓,
 * cortado no limite.
 */
export function ordenarIdsRanking(
  agregado: Map<string, AgregadoCliente>,
  limite: number = TOP_CLIENTES_LIMITE
): string[] {
  return Array.from(agregado.entries())
    .sort(([idA, a], [idB, b]) => b.valor - a.valor || b.pedidos - a.pedidos || idA.localeCompare(idB))
    .slice(0, Math.max(limite, 0))
    .map(([id]) => id);
}

/**
 * Monta a lista final na ordem do ranking. Id sem linha de cliente é pulado
 * (a ligação é inner join, mas não pode quebrar o card por 1 linha faltando).
 */
export function montarRanking(
  ids: string[],
  clientes: ClienteRanking[],
  agregado: Map<string, AgregadoCliente>
): TopCliente[] {
  const porId = new Map(clientes.map((c) => [c.id, c]));

  const ranking: TopCliente[] = [];
  for (const id of ids) {
    const cliente = porId.get(id);
    const contagem = agregado.get(id);
    if (!cliente || !contagem) continue;
    ranking.push({
      id,
      nome: cliente.nome_razao_social || "Sem nome",
      documento: cliente.cpf_cnpj || null,
      pedidos: contagem.pedidos,
      valor: Math.round(contagem.valor * 100) / 100,
    });
  }
  return ranking;
}

/** Consulta paginada de `vendas` já recortada no escopo de carteira. */
async function carregarVendas(
  db: { from: (tabela: string) => any },
  escopo: EscopoCarteira,
  userId: string,
  equipeIds: string[]
): Promise<VendaRankingLinha[]> {
  const linhas: VendaRankingLinha[] = [];

  for (let pagina = 0; linhas.length < MAX_LINHAS_VENDAS; pagina++) {
    const inicio = pagina * PAGINA;
    let query = db
      .from("vendas")
      // inner join: só venda com cliente vinculado (e já traz o dono da carteira)
      .select("cliente_id, valor_final, valor_total, status, clientes!inner(vendedor_responsavel_id)");

    if (escopo === "proprio") {
      query = query.eq("clientes.vendedor_responsavel_id", userId);
    } else if (escopo === "equipe") {
      const ids = Array.from(new Set([userId, ...(equipeIds || [])])).filter(Boolean);
      query = query.in("clientes.vendedor_responsavel_id", ids.length ? ids : [userId]);
    }

    const { data, error } = await query
      .order("data_venda", { ascending: false })
      .range(inicio, inicio + PAGINA - 1);

    if (error) throw new Error(error.message);

    const lote = (data || []) as VendaRankingLinha[];
    linhas.push(...lote);
    if (lote.length < PAGINA) break;
  }

  return linhas;
}

interface ChaveCache {
  escopo: EscopoCarteira;
  userId: string;
  equipeIds: string[];
  limite: number;
}

const cache = new Map<string, { expira: number; itens: TopCliente[] }>();

function chaveDoCache({ escopo, userId, equipeIds, limite }: ChaveCache): string {
  return `${escopo}|${userId}|${[...(equipeIds || [])].sort().join(",")}|${limite}`;
}

/**
 * Ranking completo (nome + pedidos + valor) para o escopo informado.
 * Erro de banco devolve lista vazia (fail-open): o card mostra o aviso e a
 * listagem CLIENTES continua completa em vez de quebrar a tela.
 */
export async function topClientes(
  db: { from: (tabela: string) => any },
  { escopo, userId, equipeIds = [], limite = TOP_CLIENTES_LIMITE }: ChaveCache
): Promise<TopCliente[]> {
  const chave = chaveDoCache({ escopo, userId, equipeIds, limite });
  const guardado = cache.get(chave);
  if (guardado && guardado.expira > Date.now()) return guardado.itens;

  try {
    const linhas = await carregarVendas(db, escopo, userId, equipeIds);
    const agregado = agregarVendasPorCliente(linhas);
    const ids = ordenarIdsRanking(agregado, limite);
    let itens: TopCliente[] = [];

    if (ids.length) {
      const { data: clientes, error } = await db
        .from("clientes")
        .select("id, nome_razao_social, cpf_cnpj")
        .in("id", ids);
      if (error) throw new Error(error.message);
      itens = montarRanking(ids, (clientes || []) as ClienteRanking[], agregado);
    }

    cache.set(chave, { expira: Date.now() + CACHE_TTL_MS, itens });
    return itens;
  } catch (err) {
    console.error("[topClientes] falha ao montar o ranking:", err);
    return [];
  }
}

/** Só os ids — é o que GET /api/clientes usa para tirar o Top 20 da listagem. */
export async function idsTopClientes(
  db: { from: (tabela: string) => any },
  opts: ChaveCache
): Promise<string[]> {
  const ranking = await topClientes(db, opts);
  return ranking.map((c) => c.id).filter(Boolean);
}
