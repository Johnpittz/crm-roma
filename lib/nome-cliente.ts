/**
 * Nome de cliente: normalização, palpite de tipo (pf/pj) e payload do cliente
 * criado automaticamente a partir do que veio do WhatsApp (ou do kanban).
 *
 * Usado por POST /api/tarefas — quando a tarefa não tem cliente vinculado, o
 * servidor cadastra um cliente novo com o nome + telefone do contato, para a
 * venda cair no ranking de Top 20 clientes e aparecer na listagem CLIENTES.
 */

/** Forma canônica de um nome: espaços colapsados, minúsculas, sem ponta. */
export function normalizarNome(nome: string | null | undefined): string {
  return (nome || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Sinais de razão social que indicam pessoa jurídica. */
const SINAIS_PJ = [/\bLTDA\b/i, /\bEIRELI\b/i, /\bEPP\b/i, /\bME\b/i, /\bS\.?A\.?\b/i];

/**
 * Palpite barato de tipo (pf/pj) só pelo nome — sem CNPJ não dá pra saber
 * melhor. Padrão é `pf`; "LTDA", "ME", "EIRELI", "EPP" e "SA" viram `pj`.
 */
export function tipoClientePeloNome(nome: string): "pf" | "pj" {
  const texto = nome || "";
  return SINAIS_PJ.some((sinal) => sinal.test(texto)) ? "pj" : "pf";
}

/**
 * Payload de `clientes` com o que a gente tem (mesmo formato do POST
 * /api/clientes, que já é caminho de produção — nada de coluna que não exista).
 */
export function payloadNovoCliente(opts: {
  nome: string;
  telefone?: string | null;
  vendedorId: string;
}): Record<string, unknown> {
  return {
    nome_razao_social: (opts.nome || "").trim().replace(/\s+/g, " "),
    telefone: (opts.telefone || "").trim() || null,
    tipo: tipoClientePeloNome(opts.nome),
    status: "ativo",
    vendedor_responsavel_id: opts.vendedorId,
  };
}
