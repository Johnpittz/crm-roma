/**
 * Helper para integração com WAHA (WhatsApp HTTP API)
 * Substitui lib/evolution-api.ts (docs/plano-implementacao-waha.md Fase 3)
 *
 * Base URL: WAHA_API_URL (externa) — ver docs/runbook-waha-numeros.md
 * Auth: header X-Api-Key (WAHA_API_KEY)
 */

export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>
import { formatarTelefone } from './telefone'

export interface WahaConfig {
  baseUrl: string
  apiKey: string
  session: string
}

export interface EnviarMensagemParams {
  telefone: string
  mensagem: string
  session?: string
}

export interface EnviarMensagemResponse {
  success: boolean
  message_id?: string | null
  error?: string
}

export interface WahaOptions {
  fetchImpl?: FetchImpl
  config?: WahaConfig
}

/**
 * Descreve erros de fetch incluindo a causa de rede (diagnóstico de produção).
 */
function descreverErro(err: any): string {
  const msg = err?.message || 'Erro desconhecido'
  const causa = err?.cause
  if (!causa) return msg
  const detalhe =
    typeof causa === 'object'
      ? `${causa.code || ''} ${causa.message || causa}`.trim()
      : String(causa)
  return `${msg} — causa: ${detalhe}`
}

/**
 * Lê a configuração do ambiente (WAHA_API_URL, WAHA_API_KEY, WAHA_SESSION).
 */
export function getWahaConfig(): WahaConfig {
  return {
    baseUrl: process.env.WAHA_API_URL || 'http://localhost:3000',
    apiKey: process.env.WAHA_API_KEY || '',
    session: process.env.WAHA_SESSION || 'ROMA_1',
  }
}

/**
 * Envia mensagem de texto via WAHA
 * POST /api/sendText
 */
export async function enviarTexto(
  params: EnviarMensagemParams,
  options: WahaOptions = {}
): Promise<EnviarMensagemResponse> {
  const config = options.config || getWahaConfig()
  const doFetch = options.fetchImpl || fetch

  if (!config.apiKey) {
    return { success: false, error: 'API Key não configurada' }
  }

  const chatId = `${formatarChatId(params.telefone)}`
  const body = {
    chatId,
    text: params.mensagem,
    session: params.session || config.session,
  }

  try {
    const response = await doFetch(`${config.baseUrl}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.apiKey,
      },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const msg = data?.error || data?.message || 'Erro na API WAHA'
      return {
        success: false,
        error: `${msg} (HTTP ${response.status})`,
      }
    }

    return { success: true, message_id: data?.id?.id || data?.id || null }
  } catch (err: any) {
    return { success: false, error: descreverErro(err) }
  }
}

/**
 * Formata telefone para o chatId do WAHA: dígitos + @c.us
 */
function formatarChatId(telefone: string): string {
  return `${formatarTelefone(telefone)}@c.us`
}

// ===== Ciclo 2 (stubs RED) =====

export type Mediatype = 'image' | 'audio' | 'video' | 'document' | 'sticker'

export interface EnviarMidiaParams {
  telefone: string
  mediatype: Mediatype
  mimetype: string
  /** base64 do arquivo (caminho legado / arquivos pequenos) */
  media?: string
  /** URL pública do arquivo no Storage — o WAHA baixa sozinho (arquivos grandes) */
  mediaUrl?: string
  fileName?: string
  session?: string
}

/**
 * Faz POST autenticado na API WAHA e normaliza a resposta.
 */
async function postWaha(
  path: string,
  body: unknown,
  options: WahaOptions = {}
): Promise<EnviarMensagemResponse> {
  const config = options.config || getWahaConfig()
  const doFetch = options.fetchImpl || fetch

  if (!config.apiKey) {
    return { success: false, error: 'API Key não configurada' }
  }

  try {
    const response = await doFetch(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.apiKey,
      },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const msg = data?.error || data?.message || 'Erro na API WAHA'
      return {
        success: false,
        error: `${msg} (HTTP ${response.status})`,
      }
    }

    return { success: true, message_id: data?.id?.id || data?.id || null }
  } catch (err: any) {
    return { success: false, error: descreverErro(err) }
  }
}

const ENDPOINT_MIDIA: Record<Mediatype, string> = {
  image: '/api/sendImage',
  video: '/api/sendVideo',
  document: '/api/sendFile',
  audio: '/api/sendFile',
  sticker: '/api/sendSticker',
}

export async function enviarMidia(
  params: EnviarMidiaParams,
  options: WahaOptions = {}
): Promise<EnviarMensagemResponse> {
  const config = options.config || getWahaConfig()
  // mediaUrl: o WAHA baixa o arquivo direto do Storage — caminho para arquivos
  // grandes (contorna o limite de 4,5 MB de corpo da Vercel; Fase 8 E2E)
  const file = params.mediaUrl
    ? { url: params.mediaUrl, ...(params.fileName ? { filename: params.fileName } : {}) }
    : {
        mimetype: params.mimetype,
        filename: params.fileName,
        data: params.media,
      }
  return postWaha(
    ENDPOINT_MIDIA[params.mediatype],
    {
      session: params.session || config.session,
      chatId: formatarChatId(params.telefone),
      file,
    },
    options
  )
}

export async function enviarAudio(
  params: { telefone: string; audio: string; session?: string },
  options: WahaOptions = {}
): Promise<EnviarMensagemResponse> {
  const config = options.config || getWahaConfig()
  return postWaha(
    '/api/sendVoice',
    {
      session: params.session || config.session,
      chatId: formatarChatId(params.telefone),
      file: {
        mimetype: 'audio/ogg; codecs=opus',
        filename: 'audio.ogg',
        data: params.audio,
      },
    },
    options
  )
}

// ===== Ciclo 3 (stub RED) =====

/**
 * Verifica status da sessão WAHA
 * GET /api/sessions/{session}
 */
export async function verificarSessao(
  options: WahaOptions = {}
): Promise<{ connected: boolean; state: string }> {
  const config = options.config || getWahaConfig()
  const doFetch = options.fetchImpl || fetch

  if (!config.apiKey) {
    return { connected: false, state: 'no_api_key' }
  }

  try {
    const response = await doFetch(`${config.baseUrl}/api/sessions/${config.session}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.apiKey,
      },
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return { connected: false, state: 'error' }
    }

    const state = data?.status || 'unknown'
    return { connected: state === 'WORKING', state }
  } catch (err: any) {
    return { connected: false, state: 'error' }
  }
}

// ===== Ciclo 4 (stubs RED) =====

export interface CheckNumberResult {
  number: string
  exists: boolean
  jid: string | null
}

export interface WahaContact {
  id: string
  remoteJid: string
  pushName: string | null
  profilePicUrl: string | null
  isSaved: boolean
  isGroup: boolean
  type: string
}

/**
 * Verifica se números existem no WhatsApp
 * GET /api/contacts/check-exists?phone=...
 */
export async function checkNumbers(
  params: { numbers: string[]; session?: string },
  options: WahaOptions = {}
): Promise<{ success: boolean; results: CheckNumberResult[]; error?: string }> {
  const config = options.config || getWahaConfig()
  const doFetch = options.fetchImpl || fetch
  const session = params.session || config.session

  if (!config.apiKey) {
    return { success: false, results: [], error: 'API Key não configurada' }
  }
  if (!params.numbers || params.numbers.length === 0) {
    return { success: false, results: [], error: 'Nenhum número informado' }
  }

  const results: CheckNumberResult[] = []
  for (const numero of params.numbers) {
    const formatado = formatarTelefone(numero)
    try {
      const response = await doFetch(
        `${config.baseUrl}/api/contacts/check-exists?phone=${formatado}&session=${session}`,
        {
          method: 'GET',
          headers: { 'X-Api-Key': config.apiKey },
        }
      )
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const msg = data?.error || data?.message || 'Erro na API WAHA'
        return { success: false, results: [], error: `${msg} (HTTP ${response.status})` }
      }

      results.push({
        number: formatado,
        exists: Boolean(data?.numberExists),
        jid: data?.chatId || null,
      })
    } catch (err: any) {
      return { success: false, results: [], error: err.message }
    }
  }

  return { success: true, results }
}

export async function findContacts(
  params: { search?: string; limit?: number; session?: string },
  options: WahaOptions = {}
): Promise<{ success: boolean; contacts: WahaContact[]; total: number; error?: string }> {
  const config = options.config || getWahaConfig()
  const doFetch = options.fetchImpl || fetch
  const session = params.session || config.session
  const limit = params.limit ?? 100

  if (!config.apiKey) {
    return { success: false, contacts: [], total: 0, error: 'API Key não configurada' }
  }

  try {
    const response = await doFetch(
      `${config.baseUrl}/api/contacts/all?session=${session}&limit=${limit}`,
      {
        method: 'GET',
        headers: { 'X-Api-Key': config.apiKey },
      }
    )
    const data = await response.json().catch(() => [])

    if (!response.ok) {
      const msg = data?.error || data?.message || 'Erro na API WAHA'
      return { success: false, contacts: [], total: 0, error: `${msg} (HTTP ${response.status})` }
    }

    let contacts: WahaContact[] = (Array.isArray(data) ? data : []).map((c: any) => ({
      id: c.id || '',
      remoteJid: c.id || '',
      pushName: c.pushName ?? c.name ?? null,
      profilePicUrl: c.profilePicUrl ?? null,
      isSaved: Boolean(c.name),
      isGroup: String(c.id || '').endsWith('@g.us'),
      type: 'contact',
    }))

    // Resolve JIDs @lid para o número real (docs/busca-contatos-whatsapp.md §8.2)
    await Promise.all(
      contacts
        .filter((c) => c.remoteJid.endsWith('@lid'))
        .map(async (c) => {
          const telefone = await resolverLid(c.remoteJid, options)
          if (telefone) {
            c.remoteJid = `${telefone}@s.whatsapp.net`
            c.id = c.remoteJid
          }
        })
    )

    // Filtro client-side (comportamento preservado — docs/busca-contatos-whatsapp.md §8.4)
    if (params.search) {
      const searchLower = params.search.toLowerCase()
      contacts = contacts.filter(
        (c) =>
          c.pushName?.toLowerCase().includes(searchLower) ||
          c.remoteJid.includes(params.search!)
      )
    }

    return { success: true, contacts, total: contacts.length }
  } catch (err: any) {
    return { success: false, contacts: [], total: 0, error: err.message }
  }
}

// ===== Ciclo Fase 6 (stub RED) =====

/**
 * Resolve um JID @lid para o número de telefone real (WAHA /api/{session}/lids/{lid}).
 * Retorna os dígitos do telefone ou null se o mapeamento não for conhecido.
 */
export async function resolverLid(
  lid: string,
  options: WahaOptions = {}
): Promise<string | null> {
  const config = options.config || getWahaConfig()
  const doFetch = options.fetchImpl || fetch

  if (!config.apiKey) return null

  try {
    const numero = lid.replace(/@lid$/, '')
    const response = await doFetch(
      `${config.baseUrl}/api/${config.session}/lids/${numero}`,
      { headers: { 'X-Api-Key': config.apiKey } }
    )
    if (!response.ok) return null
    const data = await response.json().catch(() => ({}))
    const pn: string | null = data?.pn || null
    if (!pn) return null
    return pn.replace(/@c\.us$/, '')
  } catch {
    return null
  }
}

/**
 * Busca o nome do contato no WhatsApp (WAHA GET /api/{session}/contacts/{id}).
 * Prefere `pushname` (nome do WhatsApp); fallback para `name` (nome salvo).
 */
export async function buscarNomeContato(
  telefoneOuJid: string,
  options: WahaOptions = {}
): Promise<string | null> {
  const config = options.config || getWahaConfig()
  const doFetch = options.fetchImpl || fetch

  if (!config.apiKey) return null

  try {
    const id = telefoneOuJid.includes('@') ? telefoneOuJid : formatarChatId(telefoneOuJid)
    const response = await doFetch(`${config.baseUrl}/api/${config.session}/contacts/${id}`, {
      headers: { 'X-Api-Key': config.apiKey },
    })
    if (!response.ok) return null
    const data = await response.json().catch(() => ({}))
    return data?.pushname || data?.name || null
  } catch {
    return null
  }
}

/**
 * Marca a conversa como lida no WhatsApp (WAHA POST /api/sendSeen).
 */
export async function enviarLido(
  telefone: string,
  options: WahaOptions = {}
): Promise<{ success: boolean; error?: string }> {
  const config = options.config || getWahaConfig()
  const doFetch = options.fetchImpl || fetch

  try {
    const response = await doFetch(`${config.baseUrl}/api/sendSeen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.apiKey,
      },
      body: JSON.stringify({
        session: config.session,
        chatId: formatarChatId(telefone),
      }),
    })

    if (!response.ok) {
      let message = `WAHA: erro ao marcar como lido (HTTP ${response.status})`
      try {
        const data = await response.json()
        if (data?.message) {
          message = `${data.message} (HTTP ${response.status})`
        }
      } catch {
        // corpo não-JSON: mantém mensagem genérica com status HTTP
      }
      return { success: false, error: message }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: descreverErro(err) }
  }
}
