// @vitest-environment jsdom
/**
 * REGRA (01/10/2026): o número do WhatsApp não pode sumir do modal.
 *
 * A conversa no WhatsApp TEM número (`atendimentos.telefone_cliente`), mas o
 * cadastro às vezes não tem telefone — o caso do "E-commerce", tarefa criada
 * 30/09 às 19:31, 51 min ANTES do auto-cadastro entrar em produção (20:22).
 *
 * Então, quando o cadastro está sem telefone, o modal procura a conversa com o
 * MESMO nome (regra de ligação que o próprio painel de contato já usa) e mostra
 * o número. Só mostra quando todas as conversas com esse nome apontam para o
 * MESMO número — com dois números diferentes o número não é exibido (mostrar
 * um número errado é pior que não mostrar nenhum).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ModalDetalhesCliente } from "./modal-detalhes-cliente";

const estado = vi.hoisted(() => ({
  conversas: [] as Array<{ nome_cliente: string; telefone_cliente: string | null }>,
  tabelasLidas: [] as string[],
}));

// o modal usa useRouter (navega para /atendimento) — fora do app router precisamos trocar
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (tabela: string) => {
      estado.tabelasLidas.push(tabela);
      let nome: string | null = null;
      const q: any = {
        select: () => q,
        ilike: (_col: string, valor: string) => { nome = valor; return q; },
        order: () => q,
        limit: () => q,
        // PostgREST ilike sem curinga = igualdade ignorando caixa
        then: (ok: any, erro: any) =>
          Promise.resolve({
            data: estado.conversas.filter(
              (c) => !nome || c.nome_cliente.toLowerCase() === String(nome).toLowerCase()
            ),
            error: null,
          }).then(ok, erro),
      };
      return q;
    },
  }),
}));

function clienteEcommerce(telefone: string | null) {
  return {
    id: "sem-cadastro:e-commerce",
    nome_razao_social: "E-commerce",
    cpf_cnpj: null,
    telefone,
    email: null,
    cidade: null,
    estado: null,
    status: "ativo",
    tipo: "pj",
  };
}

beforeEach(() => {
  estado.conversas = [];
  estado.tabelasLidas = [];
});

describe("ModalDetalhesCliente — telefone vindo do WhatsApp", () => {
  it("cadastro sem telefone: mostra o número da conversa com o mesmo nome", async () => {
    estado.conversas = [{ nome_cliente: "E-commerce", telefone_cliente: "556234165003" }];

    render(
      <ModalDetalhesCliente cliente={clienteEcommerce(null)} open onOpenChange={() => {}} />
    );

    await waitFor(() =>
      expect(screen.getByRole("dialog").textContent).toContain("556234165003")
    );
    expect(screen.getByRole("dialog").textContent).toContain("WhatsApp");
  });

  it("duas conversas com o MESMO nome mas números diferentes: não mostra número nenhum", async () => {
    estado.conversas = [
      { nome_cliente: "E-commerce", telefone_cliente: "556234165003" },
      { nome_cliente: "E-Commerce", telefone_cliente: "5511910085725" },
    ];

    render(
      <ModalDetalhesCliente cliente={clienteEcommerce(null)} open onOpenChange={() => {}} />
    );

    await waitFor(() =>
      expect(screen.getByRole("dialog").textContent).toContain("E-commerce")
    );
    expect(screen.getByRole("dialog").textContent).not.toContain("556234165003");
    expect(screen.getByRole("dialog").textContent).not.toContain("5511910085725");
  });

  it("cadastro COM telefone: usa o do cadastro e não consulta as conversas", async () => {
    estado.conversas = [{ nome_cliente: "E-commerce", telefone_cliente: "556234165003" }];

    render(
      <ModalDetalhesCliente cliente={clienteEcommerce("(055) 64840-5901")} open onOpenChange={() => {}} />
    );

    await waitFor(() =>
      expect(screen.getByRole("dialog").textContent).toContain("(055) 64840-5901")
    );
    expect(estado.tabelasLidas).not.toContain("atendimentos");
    expect(screen.getByRole("dialog").textContent).not.toContain("556234165003");
  });

  it("sem nenhuma conversa com esse nome: fica sem telefone (estado vazio, sem dado inventado)", async () => {
    estado.conversas = [{ nome_cliente: "Outra Empresa", telefone_cliente: "556200000000" }];

    render(
      <ModalDetalhesCliente cliente={clienteEcommerce(null)} open onOpenChange={() => {}} />
    );

    await waitFor(() =>
      expect(screen.getByRole("dialog").textContent).toContain("E-commerce")
    );
    expect(screen.getByRole("dialog").textContent).not.toContain("556200000000");
  });
});
