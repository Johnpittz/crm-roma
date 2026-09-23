/**
 * Webhook para receber mensagens do WhatsApp via WAHA (WhatsApp HTTP API)
 *
 * Endpoint: POST /api/webhooks/waha
 *
 * Substitui app/api/webhooks/evolution/route.ts (docs/plano-implementacao-waha.md Fase 4).
 * Eventos tratados (configurados na sessão WAHA):
 * - message / message.any  → cria/atualiza atendimento + insere mensagem
 * - message.ack            → atualiza ack_status da mensagem (checkmarks reais)
 * - session.status         → apenas registra (alerta de desconexão)
 *
 * Fluxo (equivalente ao webhook da Evolution):
 * 1. Rate limit + parse (lib/waha-webhook.ts)
 * 2. Ignora grupos (@g.us) e mensagens vazias
 * 3. Dedup por whatsapp_message_id
 * 4. Mídia: baixa de media.url e faz upload para o Supabase Storage (chat-media)
 * 5. Busca/cria atendimento (roteamento: vendedor do cliente → vendedor padrão)
 * 6. Insere mensagem no chat
 * 7. Dispara AI Sales (apenas texto do cliente)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { montarPromptVendas } from "@/lib/ai-sales-prompts/vendas";
import { analisarOportunidadeIA } from "@/lib/ai-sales-prompts/oportunidades";
import { rateLimit } from "@/lib/rate-limit";
import { telefoneParaDigitos } from "@/lib/telefone";
import {
  parseEventoWaha,
  mapearTipoMidiaDb,
  montarConteudo,
  type MensagemWaha,
} from "@/lib/waha-webhook";
import { enviarTexto, getWahaConfig, resolverLid, buscarNomeContato, resolverUrlMidia } from "@/lib/waha";

export const dynamic = "force-dynamic";

// Cliente Supabase lazy (service_role para bypassar RLS)
let supabaseInstance: any = null;
function getSupabase() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase URL e Service Role Key são obrigatórios");
    }
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

// ==================== UPLOAD DE MÍDIA ====================

/**
 * Faz upload de mídia (buffer) para o Supabase Storage (bucket chat-media)
 * e retorna a URL pública.
 */
async function uploadMediaToStorage(
  data: Buffer,
  mimeType: string,
  fileName: string
): Promise<string | null> {
  try {
    const folder = "whatsapp";

    const { error } = await getSupabase()
      .storage
      .from("chat-media")
      .upload(`${folder}/${fileName}`, data, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error("[Webhook WAHA] Erro upload storage:", error);
      return null;
    }

    const { data: urlData } = getSupabase()
      .storage
      .from("chat-media")
      .getPublicUrl(`${folder}/${fileName}`);

    return urlData?.publicUrl || null;
  } catch (err: any) {
    console.error("[Webhook WAHA] Erro upload mídia:", err.message);
    return null;
  }
}

/**
 * Baixa a mídia do WAHA e faz upload para o Supabase Storage.
 * Sem o passo de decrypt da Evolution — o WAHA entrega o arquivo pronto.
 * A URL é normalizada por resolverUrlMidia (media.url do evento pode vir nula/localhost);
 * com media.url nulo, o fallback consulta o histórico do chat pelo whatsapp_message_id.
 */
async function processarMidia(m: MensagemWaha): Promise<string | null> {
  if (!m.tipo_midia) return null;

  try {
    const urlArquivo = await resolverUrlMidia({
      urlMidia: m.url_midia,
      telefone: m.telefone,
      messageId: m.whatsapp_message_id,
    });
    if (!urlArquivo) {
      console.error("[Webhook WAHA] Mídia sem URL resolvível (evento sem media.url e histórico sem fallback)");
      return null;
    }

    const resp = await fetch(urlArquivo, {
      headers: { "X-Api-Key": getWahaConfig().apiKey },
    });
    if (!resp.ok) {
      console.error(`[Webhook WAHA] Erro ao baixar mídia: HTTP ${resp.status}`);
      return null;
    }
    const buffer = Buffer.from(await resp.arrayBuffer());
    const mimeType = m.tipo_midia === "image" ? "image/jpeg"
      : m.tipo_midia === "audio" ? "audio/ogg"
      : m.tipo_midia === "video" ? "video/mp4"
      : "application/octet-stream";
    const extensao = m.tipo_midia === "image" ? ".jpg"
      : m.tipo_midia === "audio" ? ".ogg"
      : m.tipo_midia === "video" ? ".mp4"
      : ".bin";
    const fileName = m.file_name || `${m.telefone}_${Date.now()}${extensao}`;

    return await uploadMediaToStorage(buffer, mimeType, fileName);
  } catch (err: any) {
    console.error("[Webhook WAHA] Erro processar mídia:", err.message);
    return null;
  }
}

// ==================== HANDLER PRINCIPAL ====================

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limit: 60 webhooks por minuto por IP
    const limit = rateLimit(request, { max: 60, windowMs: 60_000 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    // 2. Token simples de webhook (opcional — WAHA_WEBHOOK_TOKEN)
    const webhookToken = process.env.WAHA_WEBHOOK_TOKEN;
    if (webhookToken) {
      const tokenRecebido = request.headers.get("X-Webhook-Token");
      if (tokenRecebido !== webhookToken) {
        return NextResponse.json({ error: "Token inválido" }, { status: 401 });
      }
    }

    // 3. Parse normalizado (lib/waha-webhook.ts — testado com fixtures)
    const body = await request.json();
    const evento = parseEventoWaha(body);

    if (evento.evento === "ignorado") {
      return NextResponse.json({ success: true, action: "ignored_event" });
    }

    // ==================== SESSION.STATUS ====================
    if (evento.evento === "session.status") {
      console.log(`[Webhook WAHA] Sessão ${evento.session}: ${evento.status}`);
      if (evento.status !== "WORKING") {
        console.warn(`[Webhook WAHA] ATENÇÃO: sessão ${evento.session} fora do ar (${evento.status})`);
      }
      return NextResponse.json({ success: true, action: "session_status" });
    }

    // ==================== MESSAGE.ACK ====================
    if (evento.evento === "message.ack") {
      // Atualiza o status real da mensagem (checkmarks do chat)
      // Best-effort: ignora se a coluna ack_status ainda não existir (migration da Fase 7)
      await getSupabase()
        .from("atendimento_mensagens")
        .update({ ack_status: evento.ack })
        .eq("whatsapp_message_id", evento.whatsapp_message_id);
      return NextResponse.json({ success: true, action: "ack_updated" });
    }

    // ==================== MESSAGE ====================
    const dados = evento as MensagemWaha;

    // Ignorar mensagens de GRUPO
    if (dados.grupo) {
      console.log("[Webhook WAHA] Mensagem de grupo ignorada:", dados.telefone);
      return NextResponse.json({ success: true, action: "ignored_group" });
    }

    if (!dados.telefone) {
      return NextResponse.json(
        { error: "Telefone não encontrado no payload" },
        { status: 400 }
      );
    }

    // Resolve JIDs @lid para o número real antes de aceitar (débito §8.2)
    let telefoneLimpo = telefoneParaDigitos(dados.telefone);
    if (dados.de_lid) {
      const resolvido = await resolverLid(dados.jid);
      if (resolvido) {
        console.log(`[Webhook WAHA] LID resolvido: ${dados.jid} → ${resolvido}`);
        telefoneLimpo = telefoneParaDigitos(resolvido);
      } else {
        console.warn(`[Webhook WAHA] LID sem mapeamento no WAHA: ${dados.jid}`);
      }
    }
    const remetente = dados.from_me ? "vendedor" : "cliente";
    const conteudoMensagem = montarConteudo(dados);
    const temMidia = dados.tipo_midia !== null;

    if (!conteudoMensagem && !temMidia) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }

    // ==================== DEDUP ====================
    if (dados.whatsapp_message_id) {
      const { data: existente } = await getSupabase()
        .from("atendimento_mensagens")
        .select("id")
        .eq("whatsapp_message_id", dados.whatsapp_message_id)
        .limit(1)
        .maybeSingle();

      if (existente) {
        console.log("[Webhook WAHA] Mensagem duplicada ignorada:", dados.whatsapp_message_id);
        return NextResponse.json({ success: true, action: "dedup_skipped" });
      }
    }

    // ==================== MÍDIA ====================
    let urlFinalMidia = await processarMidia(dados);
    if (dados.midia_erro) {
      console.warn(`[Webhook WAHA] Mídia com erro no WAHA: ${dados.midia_erro}`);
    }

    // ==================== BUSCA CLIENTE / ATENDIMENTO ====================
    const cliente = await buscarClientePorTelefone(telefoneLimpo);
    const instanceName = body?.session || getWahaConfig().session;

    const atendimentoExistente = await buscarAtendimentoAberto(telefoneLimpo, instanceName);

    if (atendimentoExistente) {
      let vendedorUpdate = atendimentoExistente.vendedor_id;
      if (!vendedorUpdate) {
        vendedorUpdate = cliente?.vendedor_responsavel_id || (await buscarVendedorPadrao()) || null;
        console.log(`[Webhook WAHA] Atendimento ${atendimentoExistente.id} sem vendedor → atribuindo: ${vendedorUpdate}`);
      }

      await getSupabase()
        .from("atendimentos")
        .update({
          ultima_mensagem: conteudoMensagem,
          ultima_mensagem_data: new Date().toISOString(),
          ultima_mensagem_remetente: remetente,
          nao_lido: true,
          cliente_id: cliente?.id || atendimentoExistente.cliente_id,
          vendedor_id: vendedorUpdate,
        })
        .eq("id", atendimentoExistente.id);

      const insertResult = await getSupabase().from("atendimento_mensagens").insert({
        atendimento_id: atendimentoExistente.id,
        remetente,
        conteudo: conteudoMensagem,
        enviada_por: null,
        tipo_midia: mapearTipoMidiaDb(dados.tipo_midia),
        url_midia: urlFinalMidia,
        file_name: dados.file_name || null,
        whatsapp_message_id: dados.whatsapp_message_id || null,
        created_at: new Date().toISOString(),
      });

      if (insertResult.error) {
        console.error("[Webhook WAHA] ERRO AO INSERIR MENSAGEM:", insertResult.error);
      }

      if (remetente === "cliente" && !temMidia && conteudoMensagem) {
        chamarAISales(telefoneLimpo, instanceName).catch((e) =>
          console.error("[AI Sales] Erro na chamada:", e)
        );
      }

      return NextResponse.json({
        success: true,
        atendimento_id: atendimentoExistente.id,
        action: "updated",
      });
    }

    // ==================== NOVO ATENDIMENTO ====================
    const nomeResolvido =
      cliente?.nome_razao_social ||
      (!dados.from_me && dados.nome ? dados.nome.trim() : null) ||
      (!dados.from_me ? await buscarNomeContato(dados.jid || telefoneLimpo) : null) ||
      "Cliente";

    const vendedorPadrao = await buscarVendedorPadrao();
    const vendedorFinal = cliente?.vendedor_responsavel_id || vendedorPadrao || null;

    const { data: novoAtendimento, error: erroInsert } = await getSupabase()
      .from("atendimentos")
      .insert({
        cliente_id: cliente?.id || null,
        vendedor_id: vendedorFinal,
        canal: "whatsapp",
        telefone_cliente: telefoneLimpo,
        nome_cliente: nomeResolvido,
        status: "aberto",
        prioridade: cliente ? "normal" : "alta",
        assunto: conteudoMensagem.substring(0, 100),
        ultima_mensagem: conteudoMensagem,
        ultima_mensagem_data: new Date().toISOString(),
        ultima_mensagem_remetente: remetente,
        nao_lido: true,
        instance_name: instanceName,
      })
      .select()
      .single();

    if (erroInsert) {
      console.error("[Webhook WAHA] Erro ao criar atendimento:", erroInsert);
      return NextResponse.json({ error: erroInsert.message }, { status: 500 });
    }

    await getSupabase().from("atendimento_mensagens").insert({
      atendimento_id: novoAtendimento.id,
      remetente,
      conteudo: conteudoMensagem,
      enviada_por: null,
      tipo_midia: mapearTipoMidiaDb(dados.tipo_midia),
      url_midia: urlFinalMidia,
      file_name: dados.file_name || null,
      whatsapp_message_id: dados.whatsapp_message_id || null,
      created_at: new Date().toISOString(),
    });

    console.log("[Webhook WAHA] Novo atendimento criado:", novoAtendimento.id);

    if (remetente === "cliente" && !temMidia && conteudoMensagem) {
      chamarAISales(telefoneLimpo, instanceName).catch((e) =>
        console.error("[AI Sales] Erro na chamada:", e)
      );
    }

    return NextResponse.json({
      success: true,
      atendimento_id: novoAtendimento.id,
      action: "created",
    });
  } catch (error: any) {
    console.error("[Webhook WAHA] Erro geral:", error);
    return NextResponse.json(
      { error: "Erro ao processar webhook", details: error.message },
      { status: 500 }
    );
  }
}

// ==================== FUNÇÕES AUXILIARES ====================
// (mesmo comportamento de app/api/webhooks/evolution/route.ts —
//  duplicação temporária até a Fase 8 remover a rota antiga)

/**
 * Busca cliente pelo telefone no banco de dados
 */
async function buscarClientePorTelefone(telefoneLimpo: string) {
  const { data: clientesCandidatos } = await getSupabase()
    .from("clientes")
    .select("id, vendedor_responsavel_id, nome_razao_social, telefone, celular")
    .or(`telefone.ilike.%${telefoneLimpo.substring(0, 6)}%,celular.ilike.%${telefoneLimpo.substring(0, 6)}%`)
    .limit(50);

  if (!clientesCandidatos || clientesCandidatos.length === 0) return null;

  return clientesCandidatos.find((c: any) => {
    const telLimpo = (c.telefone || "").replace(/\D/g, "");
    const celLimpo = (c.celular || "").replace(/\D/g, "");
    return (
      telLimpo === telefoneLimpo ||
      celLimpo === telefoneLimpo ||
      telLimpo.endsWith(telefoneLimpo) ||
      celLimpo.endsWith(telefoneLimpo) ||
      telefoneLimpo.endsWith(telLimpo) ||
      telefoneLimpo.endsWith(celLimpo)
    );
  }) || null;
}

/**
 * Busca atendimento aberto existente para o telefone
 */
async function buscarAtendimentoAberto(telefoneLimpo: string, _instanceName: string | null) {
  const { data: exato } = await getSupabase()
    .from("atendimentos")
    .select("id, nome_cliente, cliente_id, vendedor_id, instance_name")
    .eq("telefone_cliente", telefoneLimpo)
    .eq("status", "aberto")
    .limit(1)
    .single();

  if (exato) return exato;

  const ultimos8 = telefoneLimpo.slice(-8);
  if (ultimos8.length < 8) return null;
  const { data: candidatos } = await getSupabase()
    .from("atendimentos")
    .select("id, nome_cliente, cliente_id, vendedor_id, telefone_cliente, instance_name")
    .eq("status", "aberto")
    .order("ultima_mensagem_data", { ascending: false })
    .limit(50);

  if (!candidatos || candidatos.length === 0) return null;

  return candidatos.find((a: any) => {
    const telBanco = (a.telefone_cliente || "").replace(/\D/g, "");
    const ultimos8Banco = telBanco.slice(-8);
    return ultimos8Banco === ultimos8 && ultimos8Banco.length >= 8;
  }) || null;
}

/**
 * Busca vendedor padrão para roteamento (config_roteamento_whatsapp → primeiro vendedor ativo)
 */
async function buscarVendedorPadrao() {
  // Tabela de configuração (MIGRATE_ROTEAMENTO.md) primeiro
  const { data: config } = await getSupabase()
    .from("config_roteamento_whatsapp")
    .select("vendedor_padrao_id")
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  if (config?.vendedor_padrao_id) return config.vendedor_padrao_id;

  const { data } = await getSupabase()
    .from("profiles")
    .select("id")
    .eq("cargo", "vendedor")
    .eq("status", "ativo")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  return data?.id || null;
}

// ==================== AI SALES ====================

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * Chama Gemini direto para responder o cliente e possívelmente criar tarefa no kanban.
 * (envio via WAHA — lib/waha.ts)
 */
async function chamarAISales(telefone: string, instanceName: string | null) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("[AI Sales] GEMINI_API_KEY não configurada, pulando");
    return;
  }

  try {
    const { data: config } = await getSupabase()
      .from("ai_sales_config")
      .select("enabled")
      .limit(1)
      .single();

    if (config && !config.enabled) {
      console.log("[AI Sales] Bot DESLIGADO pelo gestor, pulando");
      return;
    }
  } catch {
    console.log("[AI Sales] Config não encontrada, bot assume LIGADO");
  }

  try {
    const { data: atendimento } = await getSupabase()
      .from("atendimentos")
      .select("id, nome_cliente")
      .eq("telefone_cliente", telefone)
      .eq("status", "aberto")
      .limit(1)
      .single();

    if (!atendimento) return;

    const { data: mensagens } = await getSupabase()
      .from("atendimento_mensagens")
      .select("remetente, conteudo")
      .eq("atendimento_id", atendimento.id)
      .order("created_at", { ascending: true })
      .limit(20);

    if (!mensagens || mensagens.length === 0) return;

    const nomeCliente = atendimento.nome_cliente || "Cliente";
    const historico = (mensagens as { remetente: string; conteudo: string }[])
      .map((m) => `${m.remetente === "cliente" ? "Cliente" : "Vendedor"}: ${m.conteudo}`)
      .join("\n");

    const geminiPrompt = montarPromptVendas(nomeCliente, historico);
    const geminiResp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: geminiPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
      }),
      signal: AbortSignal.timeout(15000),
    });

    const geminiData = await geminiResp.json();
    const textoResposta =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!textoResposta) return;

    // Envia via WAHA (mesma sessão que recebeu)
    const resultado = await enviarTexto(
      { telefone, mensagem: textoResposta, session: instanceName || undefined },
    );
    console.log(`[AI Sales] Resposta enviada para ${telefone}: ${resultado.success ? "OK" : "FALHOU: " + resultado.error}`);

    if (resultado.success) {
      // grava o id do WAHA → dedup do webhook (message.any ecoa mensagens enviadas por nós)
      await getSupabase().from("atendimento_mensagens").insert({
        atendimento_id: atendimento.id,
        remetente: "vendedor",
        conteudo: `[IA] ${textoResposta}`,
        enviada_por: null,
        tipo_midia: "texto",
        whatsapp_message_id: (resultado as { message_id?: string }).message_id || null,
        created_at: new Date().toISOString(),
      });

      await getSupabase()
        .from("atendimentos")
        .update({
          ultima_mensagem: `[IA] ${textoResposta}`,
          ultima_mensagem_data: new Date().toISOString(),
          ultima_mensagem_remetente: "vendedor",
          nao_lido: true,
        })
        .eq("id", atendimento.id);
    }

    const oportunidade = await analisarOportunidadeIA(
      apiKey,
      nomeCliente,
      historico,
      textoResposta
    );
    if (oportunidade.criar && oportunidade.titulo) {
      await criarTarefaKanban({
        titulo: oportunidade.titulo,
        descricao: oportunidade.descricao || `Oportunidade para ${nomeCliente}`,
        prioridade: oportunidade.prioridade || "media",
        cliente_nome: nomeCliente,
      }, instanceName);
    }
  } catch (err) {
    console.error("[AI Sales] Erro:", err);
  }
}

/**
 * Cria tarefa no Kanban via service_role
 */
async function criarTarefaKanban(
  tarefa: {
    titulo: string;
    descricao: string;
    prioridade: string;
    cliente_nome: string;
  },
  instanceName: string | null
) {
  try {
    const { data: atendimento } = await getSupabase()
      .from("atendimentos")
      .select("vendedor_id")
      .eq("instance_name", instanceName)
      .eq("status", "aberto")
      .order("ultima_mensagem_data", { ascending: false })
      .limit(1)
      .single();

    const vendedorId = atendimento?.vendedor_id;
    if (!vendedorId) {
      console.log("[AI Sales] Sem vendedor para atribuir tarefa");
      return;
    }

    const { data: ultimaOrdem } = await getSupabase()
      .from("tarefas")
      .select("ordem")
      .eq("vendedor_id", vendedorId)
      .eq("coluna_kanban", "a_fazer")
      .order("ordem", { ascending: false })
      .limit(1)
      .single();

    const novaOrdem = (ultimaOrdem?.ordem || 0) + 1;

    await getSupabase().from("tarefas").insert({
      vendedor_id: vendedorId,
      titulo: tarefa.titulo,
      descricao:
        tarefa.descricao ||
        `Oportunidade identificada pela IA para ${tarefa.cliente_nome}`,
      tipo: "oportunidade",
      prioridade: tarefa.prioridade || "media",
      status: "pendente",
      coluna_kanban: "a_fazer",
      ordem: novaOrdem,
      cliente_nome: tarefa.cliente_nome,
      data_inicio: new Date().toISOString().split("T")[0],
    });

    console.log("[AI Sales] Tarefa criada:", tarefa.titulo);
  } catch (err) {
    console.error("[AI Sales] Erro ao criar tarefa:", err);
  }
}
