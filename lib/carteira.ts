/**
 * REGRA DE NEGÓCIO — a carteira é dividida ENTRE OS GESTORES.
 * (Documentada em PROGRESSO.MD §14 e docs/README.md — mudou em 23/09/2026.)
 *
 *   vendedor           -> só os próprios clientes
 *   gerente_comercial  -> a carteira da SUA equipe (vendedores com gestor_id
 *                         apontando pra ele) + a carteira própria
 *   diretor / admin    -> a carteira toda (direção)
 *   demonstracao       -> própria (vazia de propósito: o sidebar já esconde
 *                         /clientes de demo — "não deve ver clientes reais")
 *
 * Produção 23/09/2026: GERENTE 1.928 + Jackson 1.145 = 3.073.
 *
 * Fonte única da verdade: os 5 pontos que leem a base de clientes (página
 * /clientes, GET /api/clientes, card do atendimento, dropdown de nova venda e
 * /api/promocoes/clientes) passam por aqui — quando a regra mudar, é este
 * arquivo que muda.
 */

/** O que o usuário logado pode enxergar da base de clientes. */
export type EscopoCarteira = "todos" | "equipe" | "proprio";

/** Direção: vê a carteira toda. */
const CARGOS_VISAO_TOTAL = ["diretor", "admin"];

/** Gestores: veem só a carteira da própria equipe. */
const CARGOS_VISAO_EQUIPE = ["gerente_comercial"];

/** Cargos de gerência (não inclui demonstração). */
export function ehGestor(cargo: string | null | undefined): boolean {
  if (!cargo) return false;
  return CARGOS_VISAO_TOTAL.includes(cargo) || CARGOS_VISAO_EQUIPE.includes(cargo);
}

/**
 * Escopo de clientes para o cargo informado.
 * Fail-closed: cargo desconhecido, vazio ou ausente => apenas os próprios.
 */
export function escopoCarteira(cargo: string | null | undefined): EscopoCarteira {
  const c = cargo || "";
  if (CARGOS_VISAO_TOTAL.includes(c)) return "todos";
  if (CARGOS_VISAO_EQUIPE.includes(c)) return "equipe";
  return "proprio";
}

/**
 * Resolve os ids da equipe de um gestor (`profiles.gestor_id = gestorId`).
 * Erro de banco devolve lista vazia: o escopo "equipe" vira "só o dele"
 * (fail-closed) em vez de derrubar a página.
 */
export async function idsDaEquipe(
  db: { from: (tabela: string) => any },
  gestorId: string
): Promise<string[]> {
  try {
    const { data, error } = await db.from("profiles").select("id").eq("gestor_id", gestorId);
    if (error || !Array.isArray(data)) return [];
    return data.map((p: { id: string }) => p?.id).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

/**
 * Aplica o escopo numa query do supabase-js sobre `clientes`.
 * Recebe e devolve a própria query (encadeável), sem side effect quando é "todos".
 * Chamar ANTES de `.order()`/`.limit()` — o filtro tem que entrar na query.
 */
export function aplicarEscopoClientes<Q>(
  query: Q,
  escopo: EscopoCarteira,
  userId: string,
  equipeIds: string[] = []
): Q {
  if (escopo === "todos") return query;

  const q = query as unknown as {
    eq: (col: string, valor: string) => unknown;
    in: (col: string, valores: string[]) => unknown;
  };

  if (escopo === "proprio") {
    q.eq("vendedor_responsavel_id", userId);
    return query;
  }

  // "equipe": equipe + o próprio gestor, sem duplicar (Jackson é gestor de si mesmo)
  const ids = Array.from(new Set([userId, ...equipeIds])).filter(Boolean);
  q.in("vendedor_responsavel_id", ids.length ? ids : [userId]);
  return query;
}

/**
 * Checagem em memória, para onde o filtro não dá pra entrar na query
 * (agregação no servidor, como o /api/promocoes/clientes).
 */
export function pertenceAoEscopo(
  escopo: EscopoCarteira,
  userId: string,
  equipeIds: string[],
  vendedorId: string | null | undefined
): boolean {
  if (escopo === "todos") return true;
  if (!vendedorId) return false; // cliente sem vendedor: só a direção vê
  if (escopo === "proprio") return vendedorId === userId;
  return vendedorId === userId || (equipeIds || []).includes(vendedorId);
}
