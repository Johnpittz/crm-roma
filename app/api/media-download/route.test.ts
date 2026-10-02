// @vitest-environment node
/**
 * REGRA (01/10/2026): o download de documento do chat não pode depender de o
 * arquivo estar no Storage.
 *
 * - Mensagem já salva (url_midia) → redireciona (comportamento antigo).
 * - Mensagem SEM url (planilhas antigas: o bucket bloqueava o upload) →
 *   resolve a URL real no WAHA (media.url / histórico do chat), baixa com a
 *   API key, devolve os bytes com `Content-Disposition: attachment` e — auto-cura
 *   — grava o arquivo no Storage + `url_midia`, para os próximos downloads serem
 *   diretos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const ctx = vi.hoisted(() => {
  // ambiente: lido ANTES do import da rota (a rota congela config no import)
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://sup.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.WAHA_API_URL = "http://waha.test";
  process.env.WAHA_API_KEY = "chave-waha";
  process.env.WAHA_SESSION = "ROMA_1";
  process.env.EVOLUTION_API_URL = "http://evolution.test";
  process.env.EVOLUTION_API_KEY = "chave-evo";

  const estado: any = { mensagens: [], atendimentos: [], uploads: [] as any[], proximoId: 1 };

  function query(tabela: string) {
    const filtros: ((l: any) => boolean)[] = [];
    let updatePayload: any = null;
    const base = () => (estado[tabela] || []).filter((l: any) => filtros.every((f) => f(l)));
    const aplicar = () => {
      if (updatePayload) {
        const alvos = base();
        alvos.forEach((l: any) => Object.assign(l, updatePayload));
        return { data: alvos, error: null };
      }
      return { data: base(), error: null };
    };
    const q: any = {
      select: () => q,
      update: (d: any) => { updatePayload = d; return q; },
      eq: (c: string, v: any) => { filtros.push((l: any) => l[c] === v); return q; },
      limit: () => q,
      maybeSingle: async () => {
        const r = aplicar();
        return { data: r.data[0] ?? null, error: r.data[0] ? null : { message: "0 linhas" } };
      },
      then: (ok: any, err: any) => Promise.resolve(aplicar()).then(ok, err),
    };
    return q;
  }

  function fakeFetch(url: string, init?: any): Promise<Response> {
    // histórico do chat (WAHA)
    if (url.includes("/chats/") && url.includes("/messages")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            messages: [
              { payload: { id: ctx.estado.wppIdAtual, media: { url: "http://localhost:3000/api/files/ROMA_1/3EB075542480497D6F445B.xlsx" } } },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    }
    // arquivo no WAHA
    if (url.includes("/api/files/")) {
      return Promise.resolve(
        new Response(Buffer.from("PK\x03\x04-arquivo-xlsx"), {
          status: 200,
          headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
        })
      );
    }
    return Promise.resolve(new Response("chamada inesperada: " + url, { status: 500 }));
  }

  return { estado, query, fakeFetch, chamadasFetch: [] as string[] };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (tabela: string) => ctx.query(tabela) }),
}));

vi.mock("@/lib/media-storage", () => ({
  uploadMediaToStorage: vi.fn(async (base64: string, mime: string, prefix: string) => {
    ctx.estado.uploads.push({ base64, mime, prefix });
    return "https://sup.test/storage/v1/object/public/chat-media/whatsapp/auto.xlsx";
  }),
}));

import { GET } from "./route";

function preparar(mensagem: Partial<any>) {
  // id único por teste: a rota tem cache em memória por whatsapp_message_id
  const wppId = `wpp-${ctx.estado.proximoId++}`;
  ctx.estado.wppIdAtual = wppId;
  // as chaves precisam ser os nomes REAIS das tabelas (a rota usa .from(nome))
  ctx.estado["atendimento_mensagens"] = [
    { id: "uuid-msg", atendimento_id: "att-1", whatsapp_message_id: wppId, tipo_midia: "documento", url_midia: null, file_name: null, ...mensagem },
  ];
  ctx.estado["atendimentos"] = [{ id: "att-1", telefone_cliente: "556234165050", instance_name: "ROMA_1" }];
  ctx.estado.uploads = [];
  ctx.estado.mensagens = ctx.estado["atendimento_mensagens"]; // atalho p/ as asserções
}

const requisitar = (msgId: string, type = "document") =>
  GET(new Request(`http://local/api/media-download?msg_id=${encodeURIComponent(msgId)}&type=${type}`) as any);

describe("GET /api/media-download — documento do chat", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    ctx.chamadasFetch.length = 0;
    vi.stubGlobal("fetch", (url: any, init?: any) => {
      const alvo = typeof url === "string" ? url : url?.url || "";
      ctx.chamadasFetch.push(alvo);
      if (alvo.includes("evolution.test")) return Promise.resolve(new Response("evolution fora", { status: 500 }));
      return ctx.fakeFetch(alvo, init);
    });
  });

  it("mensagem sem url_midia: baixa pelo WAHA, devolve anexo com o nome do arquivo", async () => {
    preparar({ file_name: "hikvision-abaixo-minimo-01-10.xlsx" });

    const res = await requisitar("uuid-msg");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
    const disp = res.headers.get("Content-Disposition") || "";
    expect(disp).toContain("attachment");
    expect(disp).toContain("hikvision-abaixo-minimo-01-10.xlsx");
    const corpo = Buffer.from(await res.arrayBuffer());
    expect(corpo.subarray(0, 2).toString()).toBe("PK"); // é um .xlsx de verdade
    // não caiu no caminho legado (Evolution)
    expect(ctx.chamadasFetch.some((u) => u.includes("evolution.test"))).toBe(false);
  });

  it("auto-cura: grava o arquivo no Storage e passa a preencher url_midia", async () => {
    preparar({ file_name: "curva.xls" });

    await requisitar("uuid-msg");

    expect(ctx.estado.uploads).toHaveLength(1);
    expect(ctx.estado.uploads[0].prefix).toBe("whatsapp");
    expect(ctx.estado.mensagens[0].url_midia).toBe("https://sup.test/storage/v1/object/public/chat-media/whatsapp/auto.xlsx");
  });

  it("regressão: mensagem com url_midia salva continua redirecionando", async () => {
    preparar({ url_midia: "https://sup.test/storage/v1/object/public/chat-media/whatsapp/antigo.pdf", file_name: "antigo.pdf" });

    const res = await requisitar("uuid-msg");

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://sup.test/storage/v1/object/public/chat-media/whatsapp/antigo.pdf");
    expect(ctx.estado.uploads).toHaveLength(0);
  });

  it("mensagem inexistente devolve 404", async () => {
    preparar({});
    const res = await requisitar("id-que-nao-existe");
    expect(res.status).toBe(404);
  });
});
