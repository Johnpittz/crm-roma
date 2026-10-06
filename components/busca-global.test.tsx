// @vitest-environment jsdom
/**
 * REGRA (05/10/2026): busca global com Ctrl+K — cliente, conversa e tarefa num
 * lugar só (antes cada um tinha sua busca e ainda assim era fácil perder tempo).
 *
 * O painel só navega para páginas/filtros que JÁ existem:
 *   cliente  → /clientes?q=...        (a página já lê ?q)
 *   conversa → /atendimento?conversa= (a página passa a abrir a conversa)
 *   tarefa   → /kanban?tab=tarefas&q= (o campo de busca começa preenchido)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const ctx = vi.hoisted(() => ({
  chamadas: [] as string[],
  respostas: {} as Record<string, any>,
}));

vi.stubGlobal(
  "fetch",
  vi.fn((url: any) => {
    const alvo = typeof url === "string" ? url : String(url);
    ctx.chamadas.push(alvo);
    const base = alvo.split("?")[0];
    const corpo = ctx.respostas[base] ?? {};
    return Promise.resolve({ ok: true, json: async () => corpo });
  })
);

import { BuscaGlobal } from "./busca-global";

const abrirComCtrlK = () =>
  fireEvent.keyDown(document, { key: "k", ctrlKey: true, metaKey: false });

describe("BuscaGlobal — Ctrl+K", () => {
  beforeEach(() => {
    push.mockClear();
    ctx.chamadas.length = 0;
    ctx.respostas = {
      "/api/clientes": {
        clientes: [{ id: "c1", nome_razao_social: "Produto XYZ Ltda", telefone: "556234165003" }],
      },
      "/api/atendimentos": {
        atendimentos: [{ id: "att-9", nome_cliente: "Produto XYZ Distribuidora", telefone_cliente: "556234165050" }],
      },
      "/api/tarefas": {
        tarefas: [{ id: "t1", titulo: "MANDAR ORÇAMENTO", cliente_nome: "Produto XYZ Ltda" }],
      },
    };
  });
  afterEach(cleanup);

  it("abre com Ctrl+K e fecha com Esc", async () => {
    render(<BuscaGlobal />);
    expect(screen.queryByPlaceholderText(/buscar/i)).toBeNull();

    abrirComCtrlK();
    expect(screen.getByPlaceholderText(/buscar/i)).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByPlaceholderText(/buscar/i)).toBeNull());
  });

  it("mostra clientes, conversas e tarefas achadas", async () => {
    render(<BuscaGlobal />);
    abrirComCtrlK();

    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: "produto xyz" } });

    // o mesmo nome aparece em cliente e tarefa → pega todos
    await waitFor(() => expect(screen.getAllByText("Produto XYZ Ltda").length).toBeGreaterThan(0), { timeout: 2000 });
    expect(screen.getByText("Produto XYZ Distribuidora")).toBeTruthy();
    expect(screen.getByText(/MANDAR ORÇAMENTO/)).toBeTruthy();

    // as três fontes foram consultadas
    expect(ctx.chamadas.some((u) => u.startsWith("/api/clientes?busca="))).toBe(true);
    expect(ctx.chamadas.some((u) => u.startsWith("/api/atendimentos"))).toBe(true);
    expect(ctx.chamadas.some((u) => u.startsWith("/api/tarefas"))).toBe(true);
  });

  it("Enter abre o primeiro resultado (cliente → /clientes?q=)", async () => {
    render(<BuscaGlobal />);
    abrirComCtrlK();
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: "produto xyz" } });
    // o mesmo nome aparece em cliente e tarefa → pega todos
    await waitFor(() => expect(screen.getAllByText("Produto XYZ Ltda").length).toBeGreaterThan(0), { timeout: 2000 });

    fireEvent.keyDown(document, { key: "Enter" });
    expect(push).toHaveBeenCalledTimes(1);
    expect(String(push.mock.calls[0][0])).toContain("/clientes?q=");
    expect(String(push.mock.calls[0][0])).toContain("Produto%20XYZ");
  });

  it("clique na conversa leva para /atendimento?conversa=<id>", async () => {
    render(<BuscaGlobal />);
    abrirComCtrlK();
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: "produto xyz" } });
    await waitFor(() => expect(screen.getByText("Produto XYZ Distribuidora")).toBeTruthy(), { timeout: 2000 });

    fireEvent.click(screen.getByText("Produto XYZ Distribuidora"));
    expect(push).toHaveBeenCalledWith("/atendimento?conversa=att-9");
  });

  it("termo com 1 letra não busca (evita martelar a API)", async () => {
    render(<BuscaGlobal />);
    abrirComCtrlK();
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: "p" } });
    await new Promise((r) => setTimeout(r, 400));
    expect(ctx.chamadas.some((u) => u.startsWith("/api/clientes?busca="))).toBe(false);
    expect(screen.queryByText(/MANDAR ORÇAMENTO/)).toBeNull();
  });
});
