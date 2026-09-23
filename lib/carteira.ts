/**
 * REGRA DE NEGÓCIO: cada vendedor só enxerga a própria carteira de clientes.
 *
 * Fonte única da verdade para escopo de visão. Os 5 pontos que leem a base de
 * clientes (página /clientes, GET /api/clientes, card do atendimento, dropdown
 * de nova venda e /api/promocoes/clientes) passam por aqui — quando a visão de
 * gestor sumir, é este arquivo que muda.
 */

/** O que o usuário logado pode enxergar da base de clientes. */
export type EscopoCarteira = "todos" | "proprio";

/** Cargos com visão total da carteira. `demonstracao` fica de fora de propósito:
 *  o sidebar já esconde /clientes de demonstração ("não deve ver clientes reais"). */
const CARGOS_VISAO_TOTAL = ["diretor", "admin", "gerente_comercial"];

/** Cargos de gerência (não inclui demonstração). */
export function ehGestor(cargo: string | null | undefined): boolean {
  if (!cargo) return false;
  return CARGOS_VISAO_TOTAL.includes(cargo);
}

/**
 * Escopo de clientes para o cargo informado.
 * Fail-closed: cargo desconhecido, vazio ou ausente => apenas os próprios.
 */
export function escopoCarteira(cargo: string | null | undefined): EscopoCarteira {
  return ehGestor(cargo) ? "todos" : "proprio";
}

/**
 * Aplica o escopo numa query do supabase-js sobre `clientes`.
 * Recebe e devolve a própria query (encadeável), sem side effect quando é "todos".
 */
export function aplicarEscopoClientes<Q>(query: Q, escopo: EscopoCarteira, userId: string): Q {
  if (escopo === "proprio") {
    (query as unknown as { eq: (col: string, valor: string) => unknown }).eq(
      "vendedor_responsavel_id",
      userId
    );
  }
  return query;
}
