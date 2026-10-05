// @vitest-environment node
/**
 * REGRA (05/10/2026): mensagem de mídia enviada pelo CRM não pode sair DUPLICADA.
 *
 * Fluxo do documento: client → POST /api/send/media (WAHA entrega o `message_id`)
 * → client grava a linha via POST /api/atendimentos/mensagens → webhook `message.any`
 * chega logo em seguida. Se a linha for gravada SEM o `whatsapp_message_id`, o dedup
 * do webhook não acha nada e ele insere uma SEGUNDA linha (print do João: dois
 * `hikvision-abaixo-minimo-01-10.xlsx` e dois `Produto.xls` no mesmo segundo).
 *
 * Duas travas testadas aqui:
 *  1. a rota aceita e guarda o `whatsapp_message_id` vindo do envio;
 *  2. se o webhook já tiver registrado, a rota devolve a linha existente em vez
 *     de inserir de novo (cobre a corrida em que o webhook chega primeiro).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const ctx = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://sup.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.WAHA_API_KEY = "chave-waha";

  const estado: any = { atendimento_mensagens: [], atendimentos: [], enviadosTexto: [] as any[] };

  function query(tabela: string) {
    const filtros: ((l: any) => boolean)[] = [];
    let updatePayload: any = null;
    let ordenacao: any = null;
    let limite: number | null = null;
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
    const q: any = {
      select: () => q,
      insert: (payload: any) => {
        const linha = { id: `novo-${estado.atendimento_mensagens.length + 1}`, ...payload };
        estado[tabela].push(linha);
        return { ...q, single: async () => ({ data: linha, error: null }) };
      },
      update: (d: any) => { updatePayload = d; return q; },
      eq: (c: string, v: any) => { filtros.push((x: any) => x[c] === v); return q; },
      order: (c: string, o: any) => { ordenacao = { col: c, asc: o?.ascending !== false }; return q; },
      limit: (n: number) => { limite = n; return q; },
      single: async () => {
        const r = aplicar();
        return { data: r.data[0] ?? null, error: r.data[0] ? null : { message: "0 linhas" } };
      },
      maybeSingle: async () => {
        const r = aplicar();
        return { data: r.data[0] ?? null, error: r.data[0] ? null : { message: "0 linhas" } };
      },
      then: (ok: any, err: any) => Promise.resolve(aplicar()).then(ok, err),
    };
    return q;
  }

  return {
    estado,
    query,
    chamadasWaha: [] as any[],
    usuario: { id: "user-1" } as { id: string } | null,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: ctx.usuario }, error: ctx.usuario ? null : { message: "no user" } }) },
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (tabela: string) => ctx.query(tabela) }),
}));

vi.mock("@/lib/waha", () => ({
  enviarTexto: vi.fn(async (params: any) => {
    ctx.chamadasWaha.push(params);
    return { success: true, message_id: `wpp-texto-${ctx.chamadasWaha.length}` };
  }),
}));

import { GET, POST } from "./route";

const requisitar = (body: any) => POST({ json: async () => body } as any);

function preparar() {
  ctx.estado.atendimento_mensagens = [];
  ctx.estado.atendimentos = [
    { id: "att-1", telefone_cliente: "556282735286", instance_name: "ROMA_1" },
  ];
  ctx.chamadasWaha = [];
  ctx.usuario = { id: "user-1" };
}

describe("POST /api/atendimentos/mensagens — gravação da mensagem", () => {
  beforeEach(preparar);

  it("guarda o whatsapp_message_id devolvido pelo envio (é ele que faz o dedup do webhook)", async () => {
    const res = await requisitar({
      atendimento_id: "att-1",
      conteudo: "[document]",
      remetente: "vendedor",
      media_url: "https://sup.test/storage/v1/object/public/chat-media/enviados/a.xlsx",
      media_type: "document",
      file_name: "Produto.xls",
      whatsapp_message_id: "true_556282735286@c.us_3EB02E7A83020F624",
    });

    expect(res.status).toBe(200);
    expect(ctx.estado.atendimento_mensagens).toHaveLength(1);
    expect(ctx.estado.atendimento_mensagens[0].whatsapp_message_id).toBe(
      "true_556282735286@c.us_3EB02E7A83020F624"
    );
    expect(ctx.estado.atendimento_mensagens[0].enviada_por).toBe("user-1");
    // mídia já foi enviada por /api/send/media: não reenvia
    expect(ctx.chamadasWaha).toHaveLength(0);
  });

  it("webhook já registrou a MESMA mensagem: devolve a linha existente e NÃO duplica", async () => {
    ctx.estado.atendimento_mensagens = [
      {
        id: "linha-do-webhook",
        atendimento_id: "att-1",
        conteudo: "[document]",
        remetente: "vendedor",
        file_name: "Produto.xls",
        whatsapp_message_id: "true_556282735286@c.us_3EB02E7A83020F624",
        enviada_por: null,
      },
    ];

    const res = await requisitar({
      atendimento_id: "att-1",
      conteudo: "[document]",
      remetente: "vendedor",
      media_type: "document",
      file_name: "Produto.xls",
      whatsapp_message_id: "true_556282735286@c.us_3EB02E7A83020F624",
    });

    expect(res.status).toBe(200);
    expect(ctx.estado.atendimento_mensagens).toHaveLength(1);
    const corpo = await res.json();
    expect(corpo.mensagem.id).toBe("linha-do-webhook");
  });

  it("texto de vendedor segue enviando pelo WAHA e grava o id devolvido", async () => {
    const res = await requisitar({
      atendimento_id: "att-1",
      conteudo: "Bom dia!",
      remetente: "vendedor",
    });

    expect(res.status).toBe(200);
    expect(ctx.chamadasWaha).toHaveLength(1);
    expect(ctx.estado.atendimento_mensagens[0].whatsapp_message_id).toBe("wpp-texto-1");
  });

  it("sem login não grava nada", async () => {
    ctx.usuario = null;
    const res = await requisitar({ atendimento_id: "att-1", conteudo: "oi" });
    expect(res.status).toBe(401);
    expect(ctx.estado.atendimento_mensagens).toHaveLength(0);
  });
});

describe("GET /api/atendimentos/mensagens", () => {
  it("lista as mensagens do atendimento para quem está logado", async () => {
    preparar();
    ctx.estado.atendimento_mensagens = [
      { id: "m1", atendimento_id: "att-1", conteudo: "oi", created_at: "2026-10-05T10:00:00" },
      { id: "m2", atendimento_id: "outro", conteudo: "x", created_at: "2026-10-05T10:01:00" },
    ];
    const req = { url: "http://local/api/atendimentos/mensagens?atendimento_id=att-1" } as any;
    const res = await GET(req as any);
    const corpo = await res.json();
    expect(res.status).toBe(200);
    expect(corpo.mensagens).toHaveLength(1);
    expect(corpo.mensagens[0].id).toBe("m1");
  });
});
