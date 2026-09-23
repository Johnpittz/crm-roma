/**
 * Filtro do card CLIENTES (atendimento) e da página /clientes.
 *
 * O termo digitado é sanitizado ANTES de virar cláusula `.or()` do PostgREST:
 * vírgula/parênteses quebrariam o parser dos filtros e curinga de LIKE faria a
 * busca casar com qualquer coisa. Busca em 5 colunas para o vendedor achar o
 * cliente por nome, documento, telefone ou e-mail — sem sair da tela.
 */

const COLUNAS_BUSCA = [
  "nome_razao_social",
  "cpf_cnpj",
  "telefone",
  "celular",
  "email",
] as const;

/**
 * Limpa o termo digitado: tira vírgula/parênteses (sintaxe do `.or()`),
 * escapa curinga do LIKE e remove espaços das pontas.
 * Aceita null/undefined devolvendo string vazia.
 */
export function termoBuscaClientes(busca: string | null | undefined): string {
  if (!busca) return "";
  return busca
    .replace(/[,()]/g, " ")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Monta a cláusula `.or()` com ILIKE em todas as colunas de busca,
 * ou `null` quando não há termo útil (aí não se filtra).
 */
export function filtroBuscaClientes(busca: string | null | undefined): string | null {
  const termo = termoBuscaClientes(busca);
  if (!termo) return null;
  return COLUNAS_BUSCA.map((coluna) => `${coluna}.ilike.%${termo}%`).join(",");
}
