/**
 * Utilitários de telefone — fonte única do projeto.
 * Unifica a duplicação entre lib/evolution-api.ts e lib/botconversa.ts
 * (docs/busca-contatos-whatsapp.md §8.5).
 */

/**
 * Formata telefone para o padrão das APIs de WhatsApp:
 * remove caracteres não numéricos e adiciona o código do país (55) se ausente.
 * NÃO adiciona o 9 dígito (números fixos antigos não o têm).
 */
export function formatarTelefone(telefone: string): string {
  let nums = telefone.replace(/\D/g, '')
  if (!nums.startsWith('55')) {
    nums = '55' + nums
  }
  return nums
}

/**
 * Remove a formatação do telefone (mantém apenas dígitos).
 */
export function telefoneParaDigitos(telefone: string): string {
  return telefone.replace(/\D/g, '')
}
