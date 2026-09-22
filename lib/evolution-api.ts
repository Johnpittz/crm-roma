/**
 * Helper para integração com Evolution API
 * 
 * @deprecated LEGADO (migração WAHA — docs/plano-implementacao-waha.md).
 * Mantido apenas como rollback na Fase 8; será removido após estabilização.
 * Substituto: lib/waha.ts (env vars WAHA_API_URL / WAHA_API_KEY / WAHA_SESSION).
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8082';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'ROMA_1';

interface EnviarMensagemParams {
  telefone: string;
  mensagem: string;
  instance?: string; // Instância do Evolution API (opcional, usa a padrão se não informado)
}

interface EnviarMensagemResponse {
  success: boolean;
  message_id?: string;
  error?: string;
}

interface EnviarMidiaParams {
  telefone: string;
  mediatype: 'image' | 'audio' | 'video' | 'document';
  mimetype: string;
  media: string; // base64
  fileName?: string;
  instance?: string; // Instância do Evolution API (opcional)
}

/**
 * Envia mensagem de texto via Evolution API
 * POST /message/sendText/{instance}
 */
export async function enviarMensagemWhatsApp(params: EnviarMensagemParams): Promise<EnviarMensagemResponse> {
  const { telefone, mensagem, instance } = params;
  const instanceName = instance || EVOLUTION_INSTANCE;

  if (!EVOLUTION_API_KEY) {
    return { success: false, error: 'API Key não configurada' };
  }

  const telefoneFormatado = formatarTelefone(telefone);

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: telefoneFormatado,
          text: mensagem,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[Evolution API] Erro envio texto:', response.status, data);
      return { success: false, error: data?.message || data?.error || `HTTP ${response.status}` };
    }

    return { success: true, message_id: data?.key?.id || data?.id || null };
  } catch (err: any) {
    console.error('[Evolution API] Erro envio texto:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Envia mídia via Evolution API
 * POST /message/sendMedia/{instance}
 */
export async function enviarMidiaWhatsApp(params: EnviarMidiaParams): Promise<EnviarMensagemResponse> {
  const { telefone, mediatype, mimetype, media, fileName, instance } = params;
  const instanceName = instance || EVOLUTION_INSTANCE;

  if (!EVOLUTION_API_KEY) {
    return { success: false, error: 'API Key não configurada' };
  }

  const telefoneFormatado = formatarTelefone(telefone);

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: telefoneFormatado,
          mediatype,
          mimetype,
          media,
          fileName,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[Evolution API] Erro envio mídia:', response.status, data);
      return { success: false, error: data?.message || data?.error || `HTTP ${response.status}` };
    }

    return { success: true, message_id: data?.key?.id || data?.id || null };
  } catch (err: any) {
    console.error('[Evolution API] Erro envio mídia:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Envia áudio como nota de voz (ptt)
 * POST /message/sendWhatsAppAudio/{instance}
 */
export async function enviarAudioWhatsApp(params: {
  telefone: string;
  audio: string; // base64
  instance?: string;
}): Promise<EnviarMensagemResponse> {
  const { telefone, audio, instance } = params;
  const instanceName = instance || EVOLUTION_INSTANCE;

  if (!EVOLUTION_API_KEY) {
    return { success: false, error: 'API Key não configurada' };
  }

  const telefoneFormatado = formatarTelefone(telefone);

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendWhatsAppAudio/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: telefoneFormatado,
          audio,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[Evolution API] Erro envio áudio:', response.status, data);
      return { success: false, error: data?.message || data?.error || `HTTP ${response.status}` };
    }

    return { success: true, message_id: data?.key?.id || data?.id || null };
  } catch (err: any) {
    console.error('[Evolution API] Erro envio áudio:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Verifica status da instância
 * GET /instance/connectionState/{instance}
 */
export async function verificarStatusInstancia(): Promise<{ connected: boolean; state: string }> {
  if (!EVOLUTION_API_KEY) {
    return { connected: false, state: 'no_api_key' };
  }

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { connected: false, state: 'error' };
    }

    const state = data?.state || data?.instance?.state || 'unknown';
    const connected = state === 'open' || state === 'connected';

    return { connected, state };
  } catch (err: any) {
    console.error('[Evolution API] Erro verificar status:', err.message);
    return { connected: false, state: 'error' };
  }
}

/**
 * Formata telefone para padrão Evolution API
 * Remove caracteres não numéricos e adiciona código do país
 * (implementação única em lib/telefone.ts — reexportado por compatibilidade)
 */
import { formatarTelefone, telefoneParaDigitos } from './telefone';
export { formatarTelefone, telefoneParaDigitos };

/**
 * Lista instâncias disponíveis no Evolution API
 * GET /instance/fetchInstances
 * 
 * Tenta fetchInstances com retry. Se retornar menos que o esperado,
 * busca cada instância individualmente via /instance/connectionState/{name}
 */
export async function listarInstancias(): Promise<Array<{
  id: string;
  name: string;
  number: string;
  connectionStatus: string;
}>> {
  if (!EVOLUTION_API_KEY) {
    return [];
  }

  // Known instance names to fallback to (name → number mapping)
  const knownInstances: Record<string, string> = {
    'ROMA_1': '556234165014',
  };

  try {
    // Try fetchInstances with retry
    let data: any[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(
        `${EVOLUTION_API_URL}/instance/fetchInstances`,
        {
          headers: { 'apikey': EVOLUTION_API_KEY },
        }
      );
      if (response.ok) {
        data = (await response.json()) || [];
        if (data.length >= Object.keys(knownInstances).length) break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    // If we got fewer instances than expected, fetch missing ones individually
    const foundNames = new Set(data.map((i: any) => i.name));
    const missing = Object.keys(knownInstances).filter(n => !foundNames.has(n));

    for (const name of missing) {
      try {
        const resp = await fetch(
          `${EVOLUTION_API_URL}/instance/connectionState/${name}`,
          { headers: { 'apikey': EVOLUTION_API_KEY } }
        );
        if (resp.ok) {
          const state = await resp.json();
          const instState = state?.instance || state;
          if (instState && instState.state) {
            data.push({
              id: name,
              name: name,
              number: knownInstances[name] || '',
              connectionStatus: instState.state === 'open' ? 'open' : 'close',
            });
          }
        }
      } catch {
        // Ignore individual failures
      }
    }

    return data;
  } catch (err: any) {
    console.error('[Evolution API] Erro listar instâncias:', err.message);
    return [];
  }
}

// ============================================================
// BUSCA DE CONTATOS E VERIFICAÇÃO DE NÚMEROS
// ============================================================

/**
 * Verifica se números existem no WhatsApp
 * POST /chat/whatsappNumbers/{instance}
 */
export async function checkWhatsAppNumbers(params: {
  numbers: string[];
  instance?: string;
}): Promise<{
  success: boolean;
  results: Array<{ number: string; exists: boolean; jid: string | null }>;
  error?: string;
}> {
  const { numbers, instance } = params;
  // HARDCODE: instância correta do projeto (não usar EVOLUTION_INSTANCE que pode estar errado)
  const instanceName = instance || 'ROMA_1';

  if (!EVOLUTION_API_KEY) {
    return { success: false, results: [], error: 'API Key não configurada' };
  }

  if (!numbers || numbers.length === 0) {
    return { success: false, results: [], error: 'Nenhum número informado' };
  }

  const numerosFormatados = numbers.map(n => formatarTelefone(n));

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/chat/whatsappNumbers/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({ numbers: numerosFormatados }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[Evolution API] Erro check numbers:', response.status, data);
      return { 
        success: false, 
        results: [], 
        error: data?.message || data?.error || `HTTP ${response.status}` 
      };
    }

    const results = Array.isArray(data) ? data.map((item: any) => ({
      number: item.number || '',
      exists: item.exists || false,
      jid: item.jid || null,
    })) : [];

    return { success: true, results };
  } catch (err: any) {
    console.error('[Evolution API] Erro check numbers:', err.message);
    return { success: false, results: [], error: err.message };
  }
}

/**
 * Lista contatos do WhatsApp (agenda + contatos de grupos)
 * POST /chat/findContacts/{instance}
 */
export async function findContacts(params: {
  search?: string;
  limit?: number;
  instance?: string;
}): Promise<{
  success: boolean;
  contacts: Array<{
    id: string;
    remoteJid: string;
    pushName: string | null;
    profilePicUrl: string | null;
    isSaved: boolean;
    isGroup: boolean;
    type: string;
  }>;
  total: number;
  error?: string;
}> {
  const { search, limit = 100, instance } = params;
  // HARDCODE: instância correta do projeto (não usar EVOLUTION_INSTANCE que pode estar errado)
  const instanceName = instance || 'ROMA_1';

  if (!EVOLUTION_API_KEY) {
    return { success: false, contacts: [], total: 0, error: 'API Key não configurada' };
  }

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/chat/findContacts/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({ where: {}, limit }),
      }
    );

    const data = await response.json().catch(() => []);

    if (!response.ok) {
      console.error('[Evolution API] Erro findContacts:', response.status, data);
      return { 
        success: false, 
        contacts: [], 
        total: 0,
        error: data?.message || data?.error || `HTTP ${response.status}` 
      };
    }

    let contacts = Array.isArray(data) ? data.map((item: any) => ({
      id: item.id || '',
      remoteJid: item.remoteJid || '',
      pushName: item.pushName || null,
      profilePicUrl: item.profilePicUrl || null,
      isSaved: item.isSaved || false,
      isGroup: item.isGroup || false,
      type: item.type || 'contact',
    })) : [];

    // Filtrar por busca (client-side)
    if (search) {
      const searchLower = search.toLowerCase();
      contacts = contacts.filter((c: any) => 
        c.pushName?.toLowerCase().includes(searchLower) ||
        c.remoteJid?.includes(search)
      );
    }

    return { success: true, contacts, total: contacts.length };
  } catch (err: any) {
    console.error('[Evolution API] Erro findContacts:', err.message);
    return { success: false, contacts: [], total: 0, error: err.message };
  }
}
