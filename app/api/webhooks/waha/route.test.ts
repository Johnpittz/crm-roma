// @vitest-environment node
/**
 * REGRA (05/10/2026): o webhook do WAHA não pode gravar uma 2ª linha de uma
 * mensagem que o CRM acabou de gravar sozinho (envio de documento).
 *
 * A corrida é real e aconteceu em produção (05/10 14:06, `monitoramento.xlsx`
 * duplicado com o MESMO `whatsapp_message_id` nas duas linhas): o dedup rodava
 * ANTES de `processarMidia` (que baixa o arquivo — ~0,5 s), o CRM gravava a
 * linha nesse meio-tempo e o insert do webhook seguia sem enxergar nada.
 *
 * Testado aqui: o dedup precisa rodar de NOVO, logo antes do insert.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const ctx = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://sup.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.WAHA_API_URL = "http://waha.test";
  process.env.WAHA_API_KEY = "chave-waha";
  process.env.WAHA_SESSION = "ROMA_1";

  const estado: any = {
    atendimento_mensagens: [] as any[],
    atendimentos: [] as any[],
    clientes: [] as any[],
    profiles: [] as any[],
    config_roteamento_whatsapp: [] as any[],
    uploads: [] as any[],
    // callback disparado DURANTE o processamento de mídia (corrida)
    duranteMidia: null as null | (() => void),
    midiaProcessada: 0,
  };

  function query(tabela: string) {
    const filtros: ((l: any) => boolean)[] = [];
    let updatePayload: any = null;
    let ordenacao: any = null;
    let limite: number | null = null;
    let usarSingle = false;
    const base = () => {
      let l = (estado[tabela] || []).filter((x: any) => filtros.every((f) => f(x)));
      if (ordenacao) {
        const { col, asc } = ordenacao;
        l = [...l].sort((a: any, b: any) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
      }
      if (limite) l = l.slice(0, limite);
      return l;
    };
    const aplicar = () => {
      if (updatePayload) {
        const alvos = base();
        alvos.forEach((x: any) => Object.assign(x, updatePayload));
        return { data: alvos, error: null };
      }
      return { data: base(), error: null };
    };
    const responder = async () => {
      const r = aplicar();
      if (usarSingle) {
        const linha = r.data[0] ?? null;
        return { data: linha, error: linha ? null : { message: "0 linhas" } };
      }
      return r;
    };
    const q: any = {
      select: () => q,
      insert: (payload: any) => {
        const linha = { id: `wh-${estado.atendimento_mensagens.length + 1}`, ...payload };
        estado[tabela].push(linha);
        return { ...q, single: async () => ({ data: linha, error: null }) };
      },
      update: (d: any) => { updatePayload = d; return q; },
      eq: (c: string, v: any) => { filtros.push((x: any) => x[c] === v); return q; },
      or: () => q,
      order: (c: string, o: any) => { ordenacao = { col: c, asc: o?.ascending !== false }; return q; },
      limit: (n: number) => { limite = n; return q; },
      single: () => { usarSingle = true; return q; },
      maybeSingle: () => { usarSingle = true; return q; },
      then: (ok: any, err: any) => responder().then(ok, err),
    };
    return q;
  }

  const storage = () => ({
    from: () => ({
      upload: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "https://sup.test/storage/v1/object/public/chat-media/whatsapp/x.xls" } }),
    }),
  });

  return { estado, query, storage };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (t: string) => ctx.query(t), storage: ctx.storage() }),
}));

vi.mock("@/lib/waha", () => ({
  getWahaConfig: () => ({ baseUrl: "http://waha.test", apiKey: "chave-waha", session: "ROMA_1" }),
  resolverLid: async () => null,
  buscarNomeContato: async () => null,
  enviarTexto: async () => ({ success: true, message_id: "x" }),
  // A janela da corrida: enquanto a mídia é processada (baixa no WAHA), o CRM
  // grava a linha do envio — exatamente o que aconteceu em produção.
  resolverUrlMidia: async () => {
    ctx.estado.midiaProcessada += 1;
    ctx.estado.duranteMidia?.();
    return "http://waha.test/api/files/ROMA_1/Produto.xls";
  },
}));

vi.stubGlobal("fetch", () =>
  Promise.resolve(
    new Response(Buffer.from("PK-bytes-do-xls"), {
      status: 200,
      headers: { "Content-Type": "application/vnd.ms-excel" },
    })
  )
);

import { POST } from "./route";

const WPP_ID = "true_556282735286@c.us_3EB0DuplicidadeTeste";

function corpoEvento() {
  return {
    event: "message.any",
    session: "ROMA_1",
    payload: {
      id: WPP_ID,
      from: "556282735286@c.us",
      fromMe: true,
      body: "[document]",
      hasMedia: true,
      pushName: null,
      media: {
        mimetype: "application/vnd.ms-excel",
        filename: "Produto.xls",
        url: "http://localhost:3000/api/files/ROMA_1/Produto.xls",
        error: null,
      },
    },
  };
}

const requisitar = (corpo: any = corpoEvento()) =>
  POST({
    json: async () => corpo,
    headers: new Headers({ "x-forwarded-for": "203.0.113.7" }),
  } as any);

function preparar() {
  ctx.estado.atendimento_mensagens = [];
  ctx.estado.atendimentos = [
    {
      id: "att-1",
      telefone_cliente: "556282735286",
      instance_name: "ROMA_1",
      status: "aberto",
      nome_cliente: "João Pedro",
      cliente_id: null,
      vendedor_id: null,
    },
  ];
  ctx.estado.clientes = [];
  ctx.estado.profiles = [];
  ctx.estado.config_roteamento_whatsapp = [];
  ctx.estado.uploads = [];
  ctx.estado.duranteMidia = null;
  ctx.estado.midiaProcessada = 0;
}

describe("POST /api/webhooks/waha — dedup do envio pelo CRM", () => {
  beforeEach(preparar);

  it("o CRM gravou DURANTE o processamento da mídia: não insere a 2ª linha", async () => {
    // a linha do envio só aparece quando a mídia começa a ser processada
    ctx.estado.duranteMidia = () => {
      ctx.estado.atendimento_mensagens.push({
        id: "linha-do-crm",
        atendimento_id: "att-1",
        remetente: "vendedor",
        conteudo: "[document]",
        file_name: "Produto.xls",
        enviada_por: "user-1",
        whatsapp_message_id: WPP_ID,
      });
    };

    const res = await requisitar();

    expect(res.status).toBe(200);
    // só a linha do CRM — nada de duplicata com o mesmo id
    expect(ctx.estado.atendimento_mensagens).toHaveLength(1);
    expect(ctx.estado.atendimento_mensagens[0].id).toBe("linha-do-crm");
    const corpo = await res.json();
    expect(corpo.action).toBe("dedup_skipped");
  });

  it("o CRM já tinha gravado ANTES: ignora na hora e nem processa a mídia", async () => {
    ctx.estado.atendimento_mensagens.push({
      id: "linha-antiga",
      whatsapp_message_id: WPP_ID,
      remetente: "vendedor",
    });

    const res = await requisitar();

    expect(res.status).toBe(200);
    expect(ctx.estado.atendimento_mensagens).toHaveLength(1);
    expect(ctx.estado.midiaProcessada).toBe(0); // nem baixou arquivo
    const corpo = await res.json();
    expect(corpo.action).toBe("dedup_skipped");
  });

  it("sem ninguém no meio: grava a mensagem do WhatsApp normalmente", async () => {
    const res = await requisitar();

    expect(res.status).toBe(200);
    expect(ctx.estado.atendimento_mensagens).toHaveLength(1);
    const linha = ctx.estado.atendimento_mensagens[0];
    expect(linha.whatsapp_message_id).toBe(WPP_ID);
    expect(linha.file_name).toBe("Produto.xls");
    expect(linha.remetente).toBe("vendedor");
    expect(linha.enviada_por).toBeNull();
    expect(linha.url_midia).toContain("chat-media"); // baixou e salvou no Storage
    const corpo = await res.json();
    expect(corpo.success).toBe(true);
  });

  it("mensagem idempotente: o MESMO evento duas vezes não duplica", async () => {
    await requisitar();
    const res2 = await requisitar();
    expect(res2.status).toBe(200);
    expect(ctx.estado.atendimento_mensagens).toHaveLength(1);
    const corpo = await res2.json();
    expect(corpo.action).toBe("dedup_skipped");
  });
});
