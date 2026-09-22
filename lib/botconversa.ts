/**
 * Helper para integração com BotConversa
 * 
 * Base URL: https://backend.botconversa.com.br/api/v1/webhook
 * Auth: Authorization: Bearer {API_KEY}
 * 
 * Passo 1: GET /subscriber/get_by_phone/{phone}/ → pegar subscriber_id
 * Passo 2: POST /subscriber/{subscriber_id}/send_message/ → enviar mensagem
 */

const BOTCONVERSA_API_KEY = process.env.BOTCONVERSA_API_KEY;
const BOTCONVERSA_BASE = "https://backend.botconversa.com.br/api/v1/webhook";

interface EnviarMensagemParams {
  telefone: string;
  mensagem: string;
}

interface EnviarMensagemResponse {
  success: boolean;
  message_id?: string;
  error?: string;
}

/**
 * Busca subscriber_id pelo telefone
 * GET /subscriber/get_by_phone/{phone}/
 */
async function buscarSubscriberId(telefoneFormatado: string): Promise<string | null> {
  try {
      const response = await fetch(
        `${BOTCONVERSA_BASE}/subscriber/get_by_phone/${encodeURIComponent(telefoneFormatado)}/`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "api-key": BOTCONVERSA_API_KEY || "",
          },
        }
      );

    if (!response.ok) {
      console.error("[BotConversa] Buscar subscriber falhou:", response.status);
      return null;
    }

    const data = await response.json();
    return data?.id?.toString() || null;
  } catch (err: any) {
    console.error("[BotConversa] Erro ao buscar subscriber:", err.message);
    return null;
  }
}

/**
 * Envia mensagem via BotConversa API
 * POST /subscriber/{subscriber_id}/send_message/
 */
export async function enviarMensagemWhatsApp(params: EnviarMensagemParams): Promise<EnviarMensagemResponse> {
  const { telefone, mensagem } = params;

  console.log("[BotConversa] INICIO ENVIO");
  console.log("[BotConversa] Telefone:", telefone);
  console.log("[BotConversa] Mensagem:", mensagem);
  console.log("[BotConversa] API_KEY:", BOTCONVERSA_API_KEY ? BOTCONVERSA_API_KEY.substring(0, 8) + "..." : "VAZIA");

  if (!BOTCONVERSA_API_KEY) {
    return { success: false, error: "API Key nao configurada" };
  }

  const telefoneFormatado = formatarTelefone(telefone);
  console.log("[BotConversa] Telefone formatado:", telefoneFormatado);

  try {
    // Passo 1: Buscar subscriber_id pelo telefone
    console.log("[BotConversa] Buscando subscriber_id...");
    const subscriberId = await buscarSubscriberId(telefoneFormatado);
    console.log("[BotConversa] Subscriber ID:", subscriberId);

    if (!subscriberId) {
      console.error("[BotConversa] Subscriber nao encontrado para:", telefoneFormatado);
      return { success: false, error: "Subscriber nao encontrado" };
    }

    // Passo 2: Enviar mensagem
    const url = `${BOTCONVERSA_BASE}/subscriber/${subscriberId}/send_message/`;
    console.log("[BotConversa] URL envio:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BOTCONVERSA_API_KEY || "",
      },
      body: JSON.stringify({
        type: "text",
        value: mensagem,
      }),
    });

    const data = await response.json().catch(() => ({}));
    console.log("[BotConversa] Response status:", response.status);
    console.log("[BotConversa] Response body:", JSON.stringify(data));

    if (!response.ok) {
      console.error("[BotConversa] Erro:", response.status, JSON.stringify(data));
      return { success: false, error: data?.message || data?.error || `HTTP ${response.status}` };
    }

    console.log("[BotConversa] SUCESSO");
    return { success: true, message_id: data?.message_id || data?.id || null };
  } catch (err: any) {
    console.error("[BotConversa] Erro:", err.message);
    return { success: false, error: err.message };
  }
}

// Fonte única de formatação de telefone (docs/busca-contatos-whatsapp.md §8.5)
import { formatarTelefone, telefoneParaDigitos } from "./telefone";
export { formatarTelefone, telefoneParaDigitos };

/**
 * Busca mensagens de um subscriber (para sincronizar mensagens enviadas pelo celular)
 * GET /subscriber/{subscriber_id}/messages/ ou similar
 */
export interface MensagemBotConversa {
  id: string;
  text: string;
  direction: "incoming" | "outgoing";
  created_at: string;
}

export async function buscarMensagensSubscriber(telefone: string): Promise<MensagemBotConversa[]> {
  if (!BOTCONVERSA_API_KEY) {
    console.error("[BotConversa Sync] API Key não configurada");
    return [];
  }

  const telefoneFormatado = formatarTelefone(telefone);
  console.log("[BotConversa Sync] Buscando mensagens para:", telefoneFormatado);

  try {
    // Passo 1: Buscar subscriber_id
    const subscriberId = await buscarSubscriberId(telefoneFormatado);
    console.log("[BotConversa Sync] Subscriber ID:", subscriberId);
    if (!subscriberId) return [];

    // Tenta buscar histórico de mensagens via diferentes endpoints
    const endpoints = [
      `${BOTCONVERSA_BASE}/subscriber/${subscriberId}/messages/`,
      `${BOTCONVERSA_BASE}/subscriber/${subscriberId}/message/list/`,
      `${BOTCONVERSA_BASE}/subscriber/${subscriberId}/history/`,
      `${BOTCONVERSA_BASE}/subscriber/${subscriberId}/interactions/`,
      `${BOTCONVERSA_BASE}/subscriber/${subscriberId}/chat/`,
      `${BOTCONVERSA_BASE}/subscriber/${subscriberId}/conversations/`,
    ];

    for (const url of endpoints) {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "api-key": BOTCONVERSA_API_KEY || "",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const mensagens = Array.isArray(data) ? data : (data?.results || data?.messages || data?.data || []);
        
        if (mensagens.length > 0) {
          return mensagens.map((m: any) => ({
            id: m.id?.toString() || m.message_id?.toString() || "",
            text: m.text || m.message || m.body || m.content || "",
            direction: m.direction || m.type || m.side || "incoming",
            created_at: m.created_at || m.timestamp || m.date || m.created || new Date().toISOString(),
          }));
        }
      }
    }

    console.log("[BotConversa Sync] Nenhum endpoint de mensagens disponível (API BotConversa não expõe histórico)");
    return [];
  } catch (err: any) {
    console.error("[BotConversa Sync] Erro:", err.message);
    return [];
  }
}
