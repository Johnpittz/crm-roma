// @vitest-environment jsdom
/**
 * REGRA (01/10/2026): Configurações ganha "CONECTAR WHATSAPP".
 *
 * O usuário não deve fazer nada além de clicar e escanear: o botão chama a
 * rota que faz toda a configuração (sessão + webhook + start), o QR aparece
 * na tela depois de alguns segundos e o app vai renovando/confirmando sozinho
 * até o status virar WORKING.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { ConectarWhatsApp } from "./conectar-whatsapp";

type Resposta = { status?: number; json: any };

const ctx = vi.hoisted(() => ({
  chamadas: [] as any[],
  respostas: new Map<string, Resposta | ((body: any) => Resposta)>(),
  responder(method: string, url: string, body: any): Resposta {
    ctx.chamadas.push({ method, url, body });
    const chave = `${method} ${url}`;
    const r = ctx.respostas.get(chave);
    if (typeof r === "function") return r(body);
    return r || { status: 200, json: {} };
  },
}));

beforeEach(() => {
  ctx.chamadas = [];
  ctx.respostas = new Map();
  // situação inicial: número atual conectado
  ctx.respostas.set("GET /api/whatsapp/conectar", {
    status: 200,
    json: {
      sessaoAtual: "ROMA_1",
      sessoes: [{ name: "ROMA_1", status: "WORKING", numero: "556234165014", nome: "João Pedro" }],
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: any) => {
      const body = init?.body ? JSON.parse(init.body) : undefined;
      const r = ctx.responder((init?.method || "GET").toUpperCase(), url, body);
      return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.json } as any;
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ConectarWhatsApp — configurações", () => {
  it("mostra o número conectado ao carregar", async () => {
    render(<ConectarWhatsApp />);

    await waitFor(() => expect(screen.getByText(/João Pedro/)).toBeTruthy());
    expect(screen.getByText(/Conectado/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Conectar WhatsApp/i })).toBeTruthy();
  });

  it("clicar em Conectar WhatsApp configura tudo e mostra o QR", async () => {
    ctx.respostas.set("POST /api/whatsapp/conectar", (body: any) => {
      if (body?.action === "iniciar") return { status: 200, json: { sessao: "ROMA_1", status: "STARTING", qr: null } };
      return { status: 200, json: { sessao: "ROMA_1", status: "SCAN_QR_CODE", qr: "data:image/png;base64,UE5H" } };
    });

    render(<ConectarWhatsApp />);
    await waitFor(() => screen.getByRole("button", { name: /Conectar WhatsApp/i }));

    fireEvent.click(screen.getByRole("button", { name: /Conectar WhatsApp/i }));

    await waitFor(() => expect(screen.getByRole("img", { name: /QR/i })).toBeTruthy());
    expect(screen.getByText(/Aparelhos conectados/i)).toBeTruthy();

    // a primeira chamada já veio no formato que a rota espera
    const iniciar = ctx.chamadas.find((c) => c.method === "POST" && c.body?.action === "iniciar");
    expect(iniciar).toBeTruthy();
  });

  it("quando a pessoa escaneia (status WORKING) o QR some e vira Conectado", async () => {
    vi.useFakeTimers();
    let escaneado = false;
    ctx.respostas.set("POST /api/whatsapp/conectar", (body: any) => {
      if (body?.action === "iniciar") return { status: 200, json: { sessao: "ROMA_1", status: "SCAN_QR_CODE", qr: null } };
      if (escaneado) return { status: 200, json: { sessao: "ROMA_1", status: "WORKING", qr: null } };
      return { status: 200, json: { sessao: "ROMA_1", status: "SCAN_QR_CODE", qr: "data:image/png;base64,UE5H" } };
    });

    render(<ConectarWhatsApp />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: /Conectar WhatsApp/i }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByRole("img", { name: /QR/i })).toBeTruthy();

    // pessoa escaneou o celular → próximo ciclo confirma
    escaneado = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });

    expect(screen.queryByRole("img", { name: /QR/i })).toBeNull();
    expect(screen.getAllByText(/Conectado/i).length).toBeGreaterThan(0);
  });

  it("desconectar só depois do aviso — e o aviso diz o que se perde", async () => {
    ctx.respostas.set("POST /api/whatsapp/conectar", {
      status: 200,
      json: { status: "STOPPED", sessao: "ROMA_1", desconectado: true },
    });

    render(<ConectarWhatsApp />);
    await waitFor(() => screen.getByText(/João Pedro/));

    // abre a confirmação: o aviso aparece e NADA é chamado no WAHA ainda
    fireEvent.click(screen.getByRole("button", { name: /Desconectar número/i }));
    expect(screen.getByText(/NÃO VERÁ MAIS AS MENSAGENS/i)).toBeTruthy();
    expect(ctx.chamadas.filter((c) => c.method === "POST")).toHaveLength(0);

    // depois de cortar, a lista volta vazia
    ctx.respostas.set("GET /api/whatsapp/conectar", {
      status: 200,
      json: { sessaoAtual: "ROMA_1", sessoes: [] },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Desconectar$/i }));
    await waitFor(() => expect(ctx.chamadas.filter((c) => c.method === "POST")).toHaveLength(1));
    const posts = ctx.chamadas.filter((c) => c.method === "POST");
    expect(posts[0].body).toEqual({ action: "desconectar", session: "ROMA_1" });
    expect(await screen.findByText(/Nenhum número respondendo/i)).toBeTruthy();
  });

  it("Cancelar fecha o aviso sem tocar na sessão", async () => {
    render(<ConectarWhatsApp />);
    await waitFor(() => screen.getByText(/João Pedro/));

    fireEvent.click(screen.getByRole("button", { name: /Desconectar número/i }));
    expect(screen.getByText(/NÃO VERÁ MAIS AS MENSAGENS/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(screen.queryByText(/NÃO VERÁ MAIS AS MENSAGENS/i)).toBeNull();
    expect(ctx.chamadas.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("botão de número novo manda action iniciar com novo: true", async () => {
    ctx.respostas.set("POST /api/whatsapp/conectar", { status: 200, json: { sessao: "ROMA_2", status: "WORKING", qr: null } });

    render(<ConectarWhatsApp />);
    await waitFor(() => screen.getByRole("button", { name: /outro número/i }));

    fireEvent.click(screen.getByRole("button", { name: /outro número/i }));

    await waitFor(() => {
      const novo = ctx.chamadas.find((c) => c.method === "POST" && c.body?.novo === true);
      expect(novo).toBeTruthy();
      expect(novo.body.action).toBe("iniciar");
    });
  });
});
