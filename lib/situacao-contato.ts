/**
 * REGRA DE NEGÓCIO — "contato" do cliente na listagem do ATENDIMENTO.
 * (Combinada com o João em 30/09/2026; documentada em PROGRESSO.MD.)
 *
 *   cliente com tarefa ABERTA em dia  -> desce para o FIM da lista
 *     ("para o vendedor não se perder": quem já tem contato agendado não é a
 *      próxima prioridade);
 *   se a tarefa passar de 24h sem resposta OU o prazo estiver vencido
 *     -> ATRASADO, sobe para o TOPO (sinalizado em vermelho);
 *   tarefa CONCLUÍDA (de qualquer data) -> REALIZADO (verde);
 *   sem tarefa -> posição normal (meio).
 *
 * Ordem final: atrasados -> sem tarefa -> com tarefa em dia -> realizados.
 *
 * Regra de precedência: uma tarefa ABERTA sempre vence o histórico concluído
 * (enquanto há pendência o cliente não pode aparecer como "feito").
 *
 * Tudo aqui é puro (testável sem banco); a leitura das tarefas respeita a
 * MESMA carteira da listagem (lib/carteira.ts): vendedor só vê as próprias
 * tarefas, gestor vê as da equipe, direção vê tudo.
 */

import type { EscopoCarteira } from "@/lib/carteira";
import { normalizarNome } from "@/lib/nome-cliente";

export type SituacaoContato = "atrasado" | "em_dia" | "realizado" | "sem_tarefa";

/** O que a listagem CLIENTES pode pedir ao servidor. */
export type FiltroContato = "todos" | "atrasados" | "realizados";

/** Depois de quanto tempo sem resposta a tarefa vira "atrasada". */
export const JANELA_ATRASO_HORAS = 24;
const JANELA_ATRASO_MS = JANELA_ATRASO_HORAS * 60 * 60 * 1000;

/** Peso na ordenação (menor = aparece antes). */
const PESO: Record<SituacaoContato, number> = {
  atrasado: 0,
  sem_tarefa: 1,
  em_dia: 2,
  realizado: 3,
};

export interface TarefaSituacao {
  cliente_id?: string | null;
  cliente_nome?: string | null;
  vendedor_id?: string | null;
  coluna_kanban?: string | null;
  status?: string | null;
  created_at?: string | null;
  data_inicio?: string | null;
  hora_inicio?: string | null;
  data_fim?: string | null;
  hora_fim?: string | null;
}

/** Tarefa entregue (kanban "Concluído" ou status concluída). */
export function ehConcluida(t: TarefaSituacao): boolean {
  return t.coluna_kanban === "concluida" || t.status === "concluida";
}

/**
 * Prazo da tarefa: `data_fim` (caindo para `data_inicio`) + hora quando tem.
 * Sem hora, o vencimento é o fim do dia.
 */
export function prazoDaTarefa(t: TarefaSituacao): Date | null {
  const data = t.data_fim || t.data_inicio || null;
  if (!data) return null;
  const usaHoraFim = Boolean(t.data_fim);
  const hora = (usaHoraFim ? t.hora_fim || t.hora_inicio : t.hora_inicio || t.hora_fim) || null;
  const candidata = new Date(`${data}T${hora ? hora.slice(0, 8) : "23:59:59"}`);
  return Number.isNaN(candidata.getTime()) ? null : candidata;
}

/** Uma situação por tarefa: atrasado (24h ou prazo) | em_dia | realizado. */
export function situacaoDaTarefa(
  t: TarefaSituacao,
  agora: Date = new Date()
): Exclude<SituacaoContato, "sem_tarefa"> {
  if (ehConcluida(t)) return "realizado";

  const criada = t.created_at ? new Date(t.created_at).getTime() : NaN;
  // Sem data de criação não dá pra julgar por idade (o prazo ainda vale)
  const venceuPorIdade = Number.isFinite(criada) && agora.getTime() - criada >= JANELA_ATRASO_MS;
  const prazo = prazoDaTarefa(t);
  const venceuPrazo = Boolean(prazo && prazo.getTime() < agora.getTime());

  return venceuPorIdade || venceuPrazo ? "atrasado" : "em_dia";
}

/**
 * Agrega as tarefas em UMA situação por cliente.
 * `porNome` resolve tarefa sem `cliente_id` (cadastro antigo) — chave é o
 * nome já normalizado (lib/nome-cliente).
 */
export function situacoesPorCliente(
  tarefas: TarefaSituacao[],
  agora: Date = new Date(),
  porNome?: Map<string, string>
): Map<string, SituacaoContato> {
  const mapa = new Map<string, SituacaoContato>();

  for (const t of tarefas) {
    const id =
      t.cliente_id ||
      (t.cliente_nome && porNome ? porNome.get(normalizarNome(t.cliente_nome)) : undefined);
    if (!id) continue;

    const situacao = situacaoDaTarefa(t, agora);
    const atual = mapa.get(id);
    if (!atual || PESO[situacao] < PESO[atual]) mapa.set(id, situacao);
  }

  return mapa;
}

/**
 * Ordena a lista: atrasados -> sem tarefa -> em dia -> realizados,
 * preservando a ordem de entrada dentro de cada grupo (a ordem alfabética
 * que já vem do banco).
 */
export function ordenarPorContato(
  base: string[],
  situacaoDe: (id: string) => SituacaoContato | undefined
): string[] {
  const grupos: Record<SituacaoContato, string[]> = {
    atrasado: [],
    sem_tarefa: [],
    em_dia: [],
    realizado: [],
  };
  for (const id of base) grupos[situacaoDe(id) ?? "sem_tarefa"].push(id);
  return [
    ...grupos.atrasado,
    ...grupos.sem_tarefa,
    ...grupos.em_dia,
    ...grupos.realizado,
  ];
}

/**
 * Ordem + filtro + contagem dos três grupos (o card mostra o número em cada
 * chip: Todos / Atrasados / Realizados).
 */
export function aplicarFiltroContato(
  base: string[],
  situacaoDe: (id: string) => SituacaoContato | undefined,
  filtro: FiltroContato
): { ids: string[]; contagem: { todos: number; atrasados: number; realizados: number } } {
  const de = (id: string): SituacaoContato => situacaoDe(id) ?? "sem_tarefa";

  const contagem = { todos: base.length, atrasados: 0, realizados: 0 };
  for (const id of base) {
    const s = de(id);
    if (s === "atrasado") contagem.atrasados += 1;
    if (s === "realizado") contagem.realizados += 1;
  }

  const ordenados = ordenarPorContato(base, situacaoDe);
  const ids =
    filtro === "atrasados"
      ? ordenados.filter((id) => de(id) === "atrasado")
      : filtro === "realizados"
        ? ordenados.filter((id) => de(id) === "realizado")
        : ordenados;

  return { ids, contagem };
}

/**
 * Lê as tarefas do escopo e devolve a situação de cada cliente.
 * Falha de banco devolve mapa vazio => a listagem continua na ordem alfabética
 * (fail-open: nunca derruba o card por causa do ranking de contato).
 */
export async function situacoesDoEscopo(
  db: { from: (tabela: string) => any },
  opcoes: {
    escopo: EscopoCarteira;
    userId: string;
    equipeIds: string[];
    agora?: Date;
    /** nome normalizado -> id de cliente, para casar tarefa sem cliente_id */
    porNome?: Map<string, string>;
    /** trava de segurança para a base não crescer sem limite */
    limite?: number;
  }
): Promise<Map<string, SituacaoContato>> {
  const { escopo, userId, equipeIds, agora, porNome, limite = 20_000 } = opcoes;
  const COLUNAS =
    "cliente_id, cliente_nome, coluna_kanban, status, created_at, data_inicio, hora_inicio, data_fim, hora_fim";
  const PAGINA = 1000;
  const tarefas: TarefaSituacao[] = [];

  try {
    while (tarefas.length < limite) {
      let q = db.from("tarefas").select(COLUNAS);
      if (escopo === "proprio") {
        q = q.eq("vendedor_id", userId);
      } else if (escopo === "equipe") {
        const ids = Array.from(new Set([userId, ...(equipeIds || [])])).filter(Boolean);
        q = q.in("vendedor_id", ids.length ? ids : [userId]);
      }
      const offset = tarefas.length;
      const { data, error } = await q
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGINA - 1);

      if (error || !Array.isArray(data)) return new Map();
      tarefas.push(...(data as TarefaSituacao[]));
      if (data.length < PAGINA) break;
    }

    return situacoesPorCliente(tarefas, agora ?? new Date(), porNome);
  } catch {
    return new Map();
  }
}
