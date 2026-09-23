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

/**
 * Extrai o telefone discável de um JID do WhatsApp (lib/telefone — fonte única).
 * GOWS (WAHA) devolve `@c.us`; Baileys/Evolution devolvem `@s.whatsapp.net`.
 * @lid não resolvido e grupos (@g.us) não são discáveis → null.
 */
export function extrairTelefoneJid(jid: string | null | undefined): string | null {
  if (!jid) return null
  if (jid.includes('@lid') || jid.includes('@g.us')) return null
  const local = jid.split('@')[0]
  return /^\d{8,15}$/.test(local) ? local : null
}

/**
 * Normaliza telefone para o padrão internacional (DDI por COMPRIMENTO):
 * até 11 dígitos = nacional (DDD+número) → prefixa 55; 12+ = já internacional.
 * '' quando não há telefone. Corrige dois bugs latentes dos links existentes:
 * `55${...}` duplicava o DDI, e startsWith('55') confundia DDD 55 (Santa Maria/RS)
 * com DDI.
 */
export function telefoneInternacional(telefone: string | null | undefined): string {
  if (!telefone) return ''
  const digits = telefoneParaDigitos(telefone)
  if (!digits) return ''
  return digits.length <= 11 ? '55' + digits : digits
}

/**
 * Monta a URL wa.me para abrir conversa com o número (com ou sem contato salvo).
 * Retorna '' sem telefone (o botão não renderiza).
 */
export function urlWaMe(telefone: string | null | undefined): string {
  const intl = telefoneInternacional(telefone)
  return intl ? `https://wa.me/${intl}` : ''
}

/**
 * JID sintético (@c.us) para iniciar conversa dentro do CRM a partir de um
 * telefone — round-trip garantido com extrairTelefoneJid().
 * null sem telefone (não há o que conversar).
 */
export function telefoneParaJid(telefone: string | null | undefined): string | null {
  const intl = telefoneInternacional(telefone)
  return intl ? `${intl}@c.us` : null
}
