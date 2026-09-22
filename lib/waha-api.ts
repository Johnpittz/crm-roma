/**
 * Helper para integração com WAHA (WhatsApp HTTP API)
 * 
 * Substitui evolution-api.ts como camada de abstração para WhatsApp.
 * Mantém a mesma interface para facilitar migração.
 * 
 * WAHA Docs: https://waha.devlike.pro/
 * Engine recomendada: GOWS (WebSocket direto, sem browser)
 * 
 * Variáveis de ambiente:
 *   WAHA_URL - URL do WAHA (ex: http://localhost:3001 ou http://2.25.192.248:3001)
 *   WAHA_SESSION - Nome da session padrão (ex: ROMA_1)
 */

const WAHA_URL = process.env.WAHA_URL || 'http://localhost:3001';
const WAHA_SESSION = process.env.WAHA_SESSION || 'ROMA_1';

// ============================================================
// INTERFACES
// ============================================================

interface EnviarMensagemParams {
  telefone: string;
  mensagem: string;
  session?: string;
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
  media: string; // URL ou base64
  fileName?: string;
  session?: string;
}

// ============================================================
// ENVIO DE MENSAGENS
// ============================================================

/**
 * Envia mensagem de texto via WAHA
 * POST /api/sendText
 * 
 * Docs: https://waha.devlike.pro/docs/how-to/send-messages/
 */
export async function enviarMensagemWhatsApp(params: EnviarMensagemParams): Promise<EnviarMensagemResponse> {
  const { telefone, mensagem, session } = params;
  const sessionName = session || WAHA_SESSION;

  const telefoneFormatado = formatarTelefone(telefone);

  try {
    const response = await fetch(`${WAHA_URL}/api/sendText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: `${telefoneFormatado}@c.us`,
        text: mensagem,
        session: sessionName,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[WAHA] Erro envio texto:', response.status, data);
      return { success: false, error: data?.message || data?.error || `HTTP ${response.status}` };
    }

    return { success: true, message_id: data?.key?.id || data?.id || null };
  } catch (err: any) {
    console.error('[WAHA] Erro envio texto:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Envia mídia via WAHA
 * 
 * WAHA tem endpoints separados por tipo:
 * - POST /api/sendImage (image/jpeg, image/png, image/webp)
 * - POST /api/sendFile (documentos: pdf, docx, xlsx, etc)
 * - POST /api/sendVideo (video/mp4)
 * - POST /api/sendVoice (áudio/ptt)
 * - POST /api/sendSticker (stickers)
 */
export async function enviarMidiaWhatsApp(params: EnviarMidiaParams): Promise<EnviarMensagemResponse> {
  const { telefone, mediatype, mimetype, media, fileName, session } = params;
  const sessionName = session || WAHA_SESSION;
  const telefoneFormatado = formatarTelefone(telefone);

  // Determinar endpoint baseado no tipo
  const endpoint = getEndpointForMediaType(mediatype);

  try {
    const body: any = {
      chatId: `${telefoneFormatado}@c.us`,
      file: {
        mimetype,
        url: media, // WAHA aceita URL ou base64 com prefixo data:
      },
      session: sessionName,
    };

    // Adicionar legenda para imagem e vídeo
    if (mediatype === 'image' || mediatype === 'video') {
      body.caption = fileName || '';
    }

    // Adicionar nome do arquivo para documentos
    if (mediatype === 'document' && fileName) {
      body.file.fileName = fileName;
    }

    const response = await fetch(`${WAHA_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`[WAHA] Erro envio ${mediatype}:`, response.status, data);
      return { success: false, error: data?.message || data?.error || `HTTP ${response.status}` };
    }

    return { success: true, message_id: data?.key?.id || data?.id || null };
  } catch (err: any) {
    console.error(`[WAHA] Erro envio ${mediatype}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Envia áudio como nota de voz (ptt) via WAHA
 * POST /api/sendVoice
 */
export async function enviarAudioWhatsApp(params: {
  telefone: string;
  audio: string; // URL ou base64
  session?: string;
}): Promise<EnviarMensagemResponse> {
  const { telefone, audio, session } = params;
  const sessionName = session || WAHA_SESSION;
  const telefoneFormatado = formatarTelefone(telefone);

  try {
    const response = await fetch(`${WAHA_URL}/api/sendVoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: `${telefoneFormatado}@c.us`,
        file: {
          mimetype: 'audio/ogg; codecs=opus',
          url: audio,
        },
        session: sessionName,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[WAHA] Erro envio áudio:', response.status, data);
      return { success: false, error: data?.message || data?.error || `HTTP ${response.status}` };
    }

    return { success: true, message_id: data?.key?.id || data?.id || null };
  } catch (err: any) {
    console.error('[WAHA] Erro envio áudio:', err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================
// SESSÕES / CONEXÃO
// ============================================================

/**
 * Verifica status da sessão
 * GET /api/sessions
 */
export async function verificarStatusSessao(sessionName?: string): Promise<{ connected: boolean; state: string }> {
  const session = sessionName || WAHA_SESSION;

  try {
    const response = await fetch(`${WAHA_URL}/api/sessions/${session}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { connected: false, state: 'error' };
    }

    const status = data?.status || 'unknown';
    const connected = status === 'WORKING';

    return { connected, state: status };
  } catch (err: any) {
    console.error('[WAHA] Erro verificar status:', err.message);
    return { connected: false, state: 'error' };
  }
}

/**
 * Lista todas as sessões disponíveis
 * GET /api/sessions
 */
export async function listarSessoes(): Promise<Array<{
  name: string;
  status: string;
  engine: string;
  phone: string | null;
}>> {
  try {
    const response = await fetch(`${WAHA_URL}/api/sessions`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json().catch(() => []);

    if (!response.ok || !Array.isArray(data)) {
      return [];
    }

    return data.map((s: any) => ({
      name: s.name || '',
      status: s.status || 'UNKNOWN',
      engine: s.engine?.engine || 'unknown',
      phone: s.me?.id?.replace('@c.us', '') || null,
    }));
  } catch (err: any) {
    console.error('[WAHA] Erro listar sessões:', err.message);
    return [];
  }
}

/**
 * Obtém QR code para autenticação
 * GET /api/{session}/auth/qr
 * 
 * Retorna base64 da imagem do QR code
 */
export async function obterQRCode(sessionName?: string): Promise<string | null> {
  const session = sessionName || WAHA_SESSION;

  try {
    const response = await fetch(`${WAHA_URL}/api/${session}/auth/qr`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.error('[WAHA] Erro obter QR:', response.status);
      return null;
    }

    const data = await response.json().catch(() => (null));
    return data?.data || null; // base64 image
  } catch (err: any) {
    console.error('[WAHA] Erro obter QR:', err.message);
    return null;
  }
}

// ============================================================
// UTILITÁRIOS
// ============================================================

/**
 * Formata telefone para padrão WAHA
 * Remove caracteres não numéricos e adiciona código do país
 * Ex: (11) 99999-9999 → 5511999999999
 */
export function formatarTelefone(telefone: string): string {
  let nums = telefone.replace(/\D/g, '');
  if (!nums.startsWith('55')) {
    nums = '55' + nums;
  }
  return nums;
}

/**
 * Remove formatação do telefone
 */
export function telefoneParaDigitos(telefone: string): string {
  return telefone.replace(/\D/g, '');
}

/**
 * Retorna endpoint WAHA baseado no tipo de mídia
 */
function getEndpointForMediaType(mediatype: string): string {
  const endpoints: Record<string, string> = {
    image: '/api/sendImage',
    audio: '/api/sendVoice',
    video: '/api/sendVideo',
    document: '/api/sendFile',
    sticker: '/api/sendSticker',
  };
  return endpoints[mediatype] || '/api/sendFile';
}
