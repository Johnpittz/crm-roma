/**
 * TOP 20 CLIENTES (os que mais compraram) — regra do card de Atendimento.
 *
 *  - Ranking por VALOR TOTAL COMPRADO (desempate por nº de pedidos), dentro
 *    do escopo de carteira de quem olha (mesma régua de lib/carteira.ts).
 *  - REGRA: quem aparece no Top 20 NÃO aparece na listagem CLIENTES ao lado —
 *    o card manda `excluir_top20=1` para GET /api/clientes, que aplica o mesmo
 *    corte aqui.
 *
 * FONTES (as duas somam no mesmo ranking):
 *  1. `vendas` — integração Millennium (hoje zerada; cliente_id + valor_final);
 *  2. `tarefas` — o que o time registra no TAREFAS/KANBAN ao concluir com
 *     resultado=sucesso e valor_venda > 0. Tarefa sem cliente vinculado entra
 *     pelo `cliente_nome` e, quando esse nome casa com um cliente da base, o
 *     valor é somado no cliente real (ver aplicarResolucaoDeNomes).
 *
 * Item que continua sem cadastro aparece no ranking com id sintético
 * `sem-cadastro:<nome>` — ele NUNCA vai para o filtro de exclusão (só uuid).
 */

import type { EscopoCarteira } from "./carteira";
import { normalizarNome } from "./nome-cliente";

/** Tamanho do ranking. */
export const TOP_CLIENTES_LIMITE = 20;

/** Teto de linhas lidas por fonte (proteção contra base gigante). */
const MAX_LINHAS = 20_000;
/** Páginas de 1.000 linhas (limite padrão do PostgREST). */
const PAGINA = 1000;
/** Cache em memória por instância (o card do atendimento chama 2x por tela). */
const CACHE_TTL_MS = 2 * 60_000;
/** Máximo de nomes casados por consulta por cálculo. */
const MAX_RESOLUCOES_NOME = 30;
/** Chaves de item que ainda não têm cliente cadastrado. */
const PREFIXO_NOME = "nome:";
/** Id sintético do ranking para quem nunca foi cadastrado. */
const PREFIXO_SEM_CADASTRO = "sem-cadastro:";
/** uuid v4 — o único formato que pode ir para o filtro SQL de exclusão. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TopCliente {
  id: string; // uuid do cliente ou `sem-cadastro:<nome normalizado>`
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

/** Uma linha de `tarefas` considerada venda (sucesso + valor). */
export interface TarefaVendaLinha {
  cliente_id?: string | null;
  cliente_nome?: string | null;
  valor_venda?: number | null;
  resultado?: string | null;
}

/** Linha de `clientes` usada para rotular o ranking. */
export interface ClienteRanking {
  id: string;
  nome_razao_social?: string | null;
  cpf_cnpj?: string | null;
}

/** O que um cliente comprou, somando as fontes. */
export interface AgregadoCliente {
  pedidos: number;
  valor: number;
  /** Nome original quando a chave veio de um nome sem cliente vinculado. */
  nome?: string;
}

/**
 * Chave de agregação: o id do cliente quando existe; na falta, o nome
 * normalizado (`nome:<nome em minúsculo>`). Sem id e sem nome => null (não conta).
 */
export function chaveDoCliente(
  clienteId?: string | null,
  clienteNome?: string | null
): string | null {
  if (clienteId) return clienteId;
  const nome = normalizarNome(clienteNome);
  return nome ? `${PREFIXO_NOME}${nome}` : null;
}

/**
 * Agrega vendas do ERP por cliente: nº de pedidos + valor comprado.
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
 * Agrega as vendas registradas no TAREFAS/KANBAN.
 * Só conta o que é venda de verdade: resultado `sucesso` + valor_venda > 0
 * (mesma régua do /api/tarefas/resumo). Sem cliente vinculado a chave é o nome.
 */
export function agregarTarefasPorCliente(
  linhas: TarefaVendaLinha[]
): Map<string, AgregadoCliente> {
  const agregado = new Map<string, AgregadoCliente>();

  for (const linha of linhas || []) {
    const valor = Number(linha?.valor_venda) || 0;
    if (linha?.resultado !== "sucesso" || valor <= 0) continue;

    const chave = chaveDoCliente(linha.cliente_id, linha.cliente_nome);
    if (!chave) continue;

    const atual = agregado.get(chave) || { pedidos: 0, valor: 0 };
    atual.pedidos += 1;
    atual.valor += valor;
    if (!atual.nome && !linha.cliente_id && linha.cliente_nome) {
      atual.nome = linha.cliente_nome.trim().replace(/\s+/g, " ");
    }
    agregado.set(chave, atual);
  }

  return agregado;
}

/** Soma dois agregados (ERP + kanban) sem perder a contagem de ninguém. */
export function mesclarAcumulos(
  a: Map<string, AgregadoCliente>,
  b: Map<string, AgregadoCliente>
): Map<string, AgregadoCliente> {
  const merged = new Map<string, AgregadoCliente>();
  for (const [chave, valor] of Array.from(a.entries())) merged.set(chave, { ...valor });
  for (const [chave, valor] of Array.from(b.entries())) {
    const atual = merged.get(chave);
    if (!atual) {
      merged.set(chave, { ...valor });
      continue;
    }
    atual.pedidos += valor.pedidos;
    atual.valor += valor.valor;
    if (!atual.nome && valor.nome) atual.nome = valor.nome;
  }
  return merged;
}

/**
 * Aplica o resultado da busca de nomes sem cadastro: quando o nome bateu com
 * um cliente da base, some as duas contas no id real e apaga a chave de nome.
 * `null` = não achou cliente, a chave de nome segue no ranking como está.
 */
export function aplicarResolucaoDeNomes(
  agregado: Map<string, AgregadoCliente>,
  resolucao: Record<string, string | null>
): Map<string, AgregadoCliente> {
  const saida = new Map<string, AgregadoCliente>();
  for (const [chave, valor] of Array.from(agregado.entries())) saida.set(chave, { ...valor });

  for (const [chaveNome, idReal] of Object.entries(resolucao || {})) {
    const origem = saida.get(chaveNome);
    if (!origem || !idReal) continue;

    saida.delete(chaveNome);
    const destino = saida.get(idReal);
    if (destino) {
      destino.pedidos += origem.pedidos;
      destino.valor += origem.valor;
      delete destino.nome;
    } else {
      saida.set(idReal, { pedidos: origem.pedidos, valor: origem.valor });
    }
  }

  return saida;
}

/**
 * Ids reais (uuid) do ranking — é o que pode ir para o `.not("id","in",...)`
 * de GET /api/clientes. Item `sem-cadastro:` fica de fora: filtrar por um id
 * que não existe no banco machucaria o SQL sem tirar ninguém da lista.
 */
export function idsReaisParaExcluir(itens: TopCliente[]): string[] {
  return (itens || []).map((i) => i?.id).filter((id): id is string => !!id && UUID_RE.test(id));
}

/**
 * Chaves na ordem do ranking: valor comprado ↓, empate por nº de pedidos ↓,
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
 * Monta a lista final na ordem do ranking.
 * - chave de id: usa a linha do cliente (sem linha => pulado, não pode quebrar o card);
 * - chave de nome (`sem-cadastro:`): mostra o nome original, sem documento.
 */
export function montarRanking(
  ids: string[],
  clientes: ClienteRanking[],
  agregado: Map<string, AgregadoCliente>
): TopCliente[] {
  const porId = new Map(clientes.map((c) => [c.id, c]));

  const ranking: TopCliente[] = [];
  for (const id of ids) {
    const contagem = agregado.get(id);
    if (!contagem) continue;

    if (id.startsWith(PREFIXO_NOME)) {
      const nomeChave = id.slice(PREFIXO_NOME.length);
      ranking.push({
        id: `${PREFIXO_SEM_CADASTRO}${nomeChave}`,
        nome: contagem.nome || nomeChave,
        documento: null,
        pedidos: contagem.pedidos,
        valor: Math.round(contagem.valor * 100) / 100,
      });
      continue;
    }

    const cliente = porId.get(id);
    if (!cliente) continue;
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

  for (let pagina = 0; linhas.length < MAX_LINHAS; pagina++) {
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

/** Consulta paginada das tarefas concluídas como venda (fonte do kanban). */
async function carregarTarefasVendidas(
  db: { from: (tabela: string) => any },
  escopo: EscopoCarteira,
  userId: string,
  equipeIds: string[]
): Promise<TarefaVendaLinha[]> {
  const linhas: TarefaVendaLinha[] = [];

  for (let pagina = 0; linhas.length < MAX_LINHAS; pagina++) {
    const inicio = pagina * PAGINA;
    let query = db
      .from("tarefas")
      .select("cliente_id, cliente_nome, valor_venda, resultado")
      .eq("resultado", "sucesso")
      .gt("valor_venda", 0);

    // mesma régua de carteira: tarefa é do vendedor que a executou
    if (escopo === "proprio") {
      query = query.eq("vendedor_id", userId);
    } else if (escopo === "equipe") {
      const ids = Array.from(new Set([userId, ...(equipeIds || [])])).filter(Boolean);
      query = query.in("vendedor_id", ids.length ? ids : [userId]);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .range(inicio, inicio + PAGINA - 1);

    if (error) throw new Error(error.message);

    const lote = (data || []) as TarefaVendaLinha[];
    linhas.push(...lote);
    if (lote.length < PAGINA) break;
  }

  return linhas;
}

/** Escapa curingas do LIKE para casar o nome EXATO (só diferencia maiúscula). */
function padraoNomeExato(nome: string): string {
  return nome.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Tenta ligar as chaves de nome aos clientes da base (ilike exato).
 * Devolve o mapa `{ "nome:<x>": uuid | null }` para aplicarResolucaoDeNomes.
 */
async function buscarClientesPorNome(
  db: { from: (tabela: string) => any },
  agregado: Map<string, AgregadoCliente>
): Promise<Record<string, string | null>> {
  const chaves = Array.from(agregado.keys())
    .filter((chave) => chave.startsWith(PREFIXO_NOME))
    .slice(0, MAX_RESOLUCOES_NOME);

  const resolucao: Record<string, string | null> = {};
  await Promise.all(
    chaves.map(async (chave) => {
      try {
        const nome = agregado.get(chave)?.nome || chave.slice(PREFIXO_NOME.length);
        const { data } = await db
          .from("clientes")
          .select("id")
          .ilike("nome_razao_social", padraoNomeExato(nome))
          .limit(1);
        resolucao[chave] = data?.[0]?.id || null;
      } catch {
        resolucao[chave] = null;
      }
    })
  );
  return resolucao;
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
 * Ranking completo (nome + pedidos + valor) para o escopo informado,
 * somando ERP (`vendas`) e kanban (`tarefas`).
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
    const [vendas, tarefas] = await Promise.all([
      carregarVendas(db, escopo, userId, equipeIds),
      carregarTarefasVendidas(db, escopo, userId, equipeIds),
    ]);

    let agregado = mesclarAcumulos(
      agregarVendasPorCliente(vendas),
      agregarTarefasPorCliente(tarefas)
    );
    agregado = aplicarResolucaoDeNomes(agregado, await buscarClientesPorNome(db, agregado));

    const chaves = ordenarIdsRanking(agregado, limite);
    let itens: TopCliente[] = [];

    if (chaves.length) {
      const idsReais = chaves.filter((id) => UUID_RE.test(id));
      const { data: clientes, error } = idsReais.length
        ? await db
            .from("clientes")
            .select("id, nome_razao_social, cpf_cnpj")
            .in("id", idsReais)
        : { data: [], error: null };
      if (error) throw new Error(error.message);
      itens = montarRanking(chaves, (clientes || []) as ClienteRanking[], agregado);
    }

    cache.set(chave, { expira: Date.now() + CACHE_TTL_MS, itens });
    return itens;
  } catch (err) {
    console.error("[topClientes] falha ao montar o ranking:", err);
    return [];
  }
}

/** Só os ids reais — é o que GET /api/clientes usa para tirar o Top 20 da lista. */
export async function idsTopClientes(
  db: { from: (tabela: string) => any },
  opts: ChaveCache
): Promise<string[]> {
  const ranking = await topClientes(db, opts);
  return idsReaisParaExcluir(ranking);
}
