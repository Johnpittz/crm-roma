// @vitest-environment node
/**
 * REGRA (01/10/2026, pedido do João): botão "CONECTAR WHATSAPP" nas configurações.
 *
 * Hoje ligar um número = rodar o runbook na mão (criar sessão, setar webhook,
 * start, puxar o PNG do QR, conferir status). A rota automatiza tudo isso —
 * e o QR expira em ~20 s, por isso o fluxo é em dois passos rápidos
 * (`iniciar` → `qr` repetido pelo front) para não estourar o limite da Vercel.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const ctx = vi.hoisted(() => {
  const estado: any = {
    sessoes: {} as Record<string, { status: string }>,
    criadas: [] as any[],
    webhooks: [] as any[],
    starts: [] as string[],
    stops: [] as string[],
    qrEhJsonDeErro: false,
    chamadas: [] as string[],
  };

  function sessaoGet(nome: string) {
    const s = estado.sessoes[nome];
    if (!s) return { name: nome, status: "NOT_FOUND" };
    return { name: nome, status: s.status, ...(s as any).config ? { config: (s as any).config } : {} };
  }

  function responder(url: string, method: string, body: any): Response {
    estado.chamadas.push(`${method} ${url}`);

    // lista
    if (url.endsWith("/api/sessions") && method === "GET") {
      return Response.json(Object.keys(estado.sessoes).map((n) => sessaoGet(n)));
    }
    // cria
    if (url.endsWith("/api/sessions") && method === "POST") {
      estado.criadas.push(body);
      estado.sessoes[body.name] = { status: "STOPPED" };
      return Response.json({ name: body.name, status: "STOPPED" });
    }
    // webhook / config
    const mPut = url.match(/\/api\/sessions\/([^/]+)$/);
    if (mPut && method === "PUT") {
      estado.webhooks.push({ name: mPut[1], body });
      return Response.json(sessaoGet(mPut[1]));
    }
    if (mPut && method === "GET") {
      const s = estado.sessoes[mPut[1]];
      if (!s) return Response.json({ error: "Session not found" }, { status: 404 });
      return Response.json(sessaoGet(mPut[1]));
    }
    // start / stop
    const mAcao = url.match(/\/api\/sessions\/([^/]+)\/(start|stop)$/);
    if (mAcao && method === "POST") {
      const [, nome, acao] = mAcao;
      if (acao === "start") {
        estado.starts.push(nome);
        estado.sessoes[nome] = { status: "SCAN_QR_CODE" };
      } else {
        estado.stops.push(nome);
        estado.sessoes[nome] = { status: "STOPPED" };
      }
      return Response.json(sessaoGet(nome));
    }
    // QR
    const mQr = url.match(/\/api\/([^/]+)\/auth\/qr$/);
    if (mQr && method === "GET") {
      if (estado.qrEhJsonDeErro) {
        return Response.json({ error: "Session status is not as expected", status: "FAILED" }, { status: 400 });
      }
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }
    return Response.json({ error: `rota nao mapeada: ${method} ${url}` }, { status: 404 });
  }

  return { estado, responder };
});

vi.stubEnv("WAHA_API_URL", "http://waha.test");
vi.stubEnv("WAHA_API_KEY", "chave-teste");
vi.stubEnv("WAHA_SESSION", "ROMA_1");
vi.stubEnv("WAHA_SESSION_PREFIX", "ROMA");
vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "crm-roma-ten.vercel.app");

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    // a rota lê profiles.pra checar se é gestor
    from: (tabela: string) => {
      let idFiltrado: string | null = null;
      const q: any = {
        select: () => q,
        eq: (_c: string, v: string) => { idFiltrado = v; return q; },
        maybeSingle: async () => {
          if (tabela !== "profiles") return { data: null, error: { message: "tabela desconhecida" } };
          const linha = (ctx.estado.profiles || []).find((p: any) => p.id === idFiltrado) || null;
          return { data: linha, error: linha ? null : { message: "0 linhas" } };
        },
      };
      return q;
    },
  }),
}));

vi.stubGlobal(
  "fetch",
  (input: any, init?: any) =>
    Promise.resolve(
      ctx.responder(typeof input === "string" ? input : input?.url || "", (init?.method || "GET").toUpperCase(), init?.body ? JSON.parse(init.body) : undefined)
    )
);

import { GET, POST } from "./route";

function requisitar(body: any) {
  return POST({ json: async () => body } as any);
}

beforeEach(() => {
  ctx.estado.sessoes = { ROMA_1: { status: "WORKING" } };
  ctx.estado.criadas = [];
  ctx.estado.webhooks = [];
  ctx.estado.starts = [];
  ctx.estado.stops = [];
  ctx.estado.qrEhJsonDeErro = false;
  ctx.estado.chamadas = [];
  // perfil de quem está logado: a rota exige gestor
  ctx.estado.profiles = [{ id: "user-1", cargo: "gerente_comercial" }];
});

describe("GET /api/whatsapp/conectar — situação atual", () => {
  it("lista só as sessões que pertencem ao CRM (prefixo ROMA)", async () => {
    ctx.estado.sessoes = { ROMA_1: { status: "WORKING" }, "STK-1": { status: "WORKING" } };

    const res = await GET();
    const corpo = await res.json();

    expect(corpo.sessoes.map((s: any) => s.name)).toEqual(["ROMA_1"]);
    expect(corpo.sessoes[0].status).toBe("WORKING");
    expect(corpo.sessaoAtual).toBe("ROMA_1");
  });
});

describe("POST /api/whatsapp/conectar — iniciar", () => {
  it("número NOVO: cria a próxima sessão ROMA_N com webhook apontando pro CRM", async () => {
    ctx.estado.sessoes = { ROMA_1: { status: "WORKING" } };

    const res = await requisitar({ action: "iniciar", novo: true });
    const corpo = await res.json();

    expect(res.status).toBe(200);
    expect(corpo.sessao).toBe("ROMA_2");
    expect(ctx.estado.criadas[0].name).toBe("ROMA_2");
    // webhook é obrigatório: sem ele a mensagem não chega no CRM.
    // O WAHA (2026.9) só grava em `config.webhooks` (array) — `webhook` singular
    // dá 200 mas é ignorado (checado na mão na instância de produção).
    const conf = ctx.estado.webhooks.find((w: any) => w.name === "ROMA_2");
    expect(conf.body.config.webhooks[0].url).toContain("/api/webhooks/waha");
    expect(conf.body.config.webhooks[0].events).toContain("message.any");
    expect(ctx.estado.starts).toContain("ROMA_2");
    expect(["STARTING", "SCAN_QR_CODE", "WORKING"]).toContain(corpo.status);
  });

  it("reconectar o atual: assume a sessão padrão e inicia", async () => {
    ctx.estado.sessoes = { ROMA_1: { status: "STOPPED" } };

    const res = await requisitar({ action: "iniciar" });
    const corpo = await res.json();

    expect(corpo.sessao).toBe("ROMA_1");
    expect(ctx.estado.starts).toContain("ROMA_1");
  });

  it("sessão já com o webhook certo não é reconfigurada (não mexe na que está no ar)", async () => {
    ctx.estado.sessoes = {
      ROMA_1: {
        status: "WORKING",
        config: { webhooks: [{ url: "https://crm-roma-ten.vercel.app/api/webhooks/waha", events: ["message.any"] }] },
      },
    };

    const res = await requisitar({ action: "iniciar" });

    expect(res.status).toBe(200);
    expect(ctx.estado.webhooks).toHaveLength(0);
    expect(ctx.estado.starts).toHaveLength(0);
  });

  it("só GESTOR mexe: vendedor comum leva 403 e nada é chamado no WAHA", async () => {
    ctx.estado.profiles = [{ id: "user-1", cargo: "vendedor" }];

    const res = await requisitar({ action: "iniciar" });

    expect(res.status).toBe(403);
    expect(ctx.estado.starts).toHaveLength(0);
    expect(ctx.estado.criadas).toHaveLength(0);
    expect((await GET()).status).toBe(403);
  });

  it("desconectar: para a sessão do WAHA (nada de QR, é corte mesmo)", async () => {
    ctx.estado.sessoes = { ROMA_1: { status: "WORKING" } };

    const res = await requisitar({ action: "desconectar" });

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.sessao).toBe("ROMA_1");
    expect(corpo.status).toBe("STOPPED");
    expect(ctx.estado.stops).toContain("ROMA_1");
    expect(ctx.estado.chamadas.filter((c: string) => c.includes("auth/qr"))).toHaveLength(0);
  });

  it("sessão fora do prefixo do CRM (ex.: do outro projeto) é recusada", async () => {
    const res = await requisitar({ action: "iniciar", session: "STK-1" });
    expect(res.status).toBe(400);
    expect(ctx.estado.starts).toHaveLength(0);
  });

  it("já está WORKING: devolve status sem reiniciar nada", async () => {
    const res = await requisitar({ action: "iniciar" });
    const corpo = await res.json();

    expect(corpo.status).toBe("WORKING");
    expect(ctx.estado.starts).toHaveLength(0);
    expect(ctx.estado.stops).toHaveLength(0);
  });
});

describe("POST /api/whatsapp/conectar — QR", () => {
  it("sessão esperando scan: devolve o PNG como data URL", async () => {
    ctx.estado.sessoes = { ROMA_1: { status: "SCAN_QR_CODE" } };

    const res = await requisitar({ action: "qr", session: "ROMA_1" });
    const corpo = await res.json();

    expect(corpo.status).toBe("SCAN_QR_CODE");
    expect(corpo.qr).toMatch(/^data:image\/png;base64,/);
    // PNG de verdade
    expect(Buffer.from(corpo.qr.split(",")[1], "base64").subarray(0, 4).toString("hex")).toBe("89504e47");
  });

  it("sessão caiu (QR veio como JSON de erro): reinicia sozinha e pede pro front repetir", async () => {
    ctx.estado.sessoes = { ROMA_1: { status: "FAILED" } };
    ctx.estado.qrEhJsonDeErro = true;

    const res = await requisitar({ action: "qr", session: "ROMA_1" });
    const corpo = await res.json();

    expect(ctx.estado.stops).toContain("ROMA_1");
    expect(ctx.estado.starts).toContain("ROMA_1");
    expect(corpo.qr).toBeNull();
    expect(["STARTING", "SCAN_QR_CODE"]).toContain(corpo.status);
  });

  it("depois do scan (WORKING): só confirma, sem QR", async () => {
    ctx.estado.sessoes = { ROMA_1: { status: "WORKING" } };

    const res = await requisitar({ action: "qr", session: "ROMA_1" });
    const corpo = await res.json();

    expect(corpo.status).toBe("WORKING");
    expect(corpo.qr).toBeNull();
    expect(ctx.estado.starts).toHaveLength(0);
  });
});
