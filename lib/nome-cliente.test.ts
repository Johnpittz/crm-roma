import { describe, it, expect } from "vitest";
import {
  normalizarNome,
  tipoClientePeloNome,
  payloadNovoCliente,
} from "./nome-cliente";

/**
 * Cliente criado sozinho a partir do que veio do WhatsApp/tarefa.
 * Quando o vendedor registra venda/tarefa de um contato que não está na base,
 * o sistema monta o registro com o nome + telefone da conversa (ver
 * POST /api/tarefas) — o mesmo nome alimenta o Top 20 clientes.
 */

describe("normalizarNome", () => {
  it("trim, colapsa espaços e deixa minúsculas (mesmo nome => mesma chave)", () => {
    expect(normalizarNome("  E-commerce  ")).toBe("e-commerce");
    // caixa e espaços duplos não podem separar o mesmo contato em duas chaves
    expect(normalizarNome("E-COMMERCE")).toBe(normalizarNome("e-commerce"));
    expect(normalizarNome(" e   comércio ")).toBe("e comércio");
  });

  it("texto vazio/nulo vira string vazia (não vira chave de ranking)", () => {
    expect(normalizarNome(null)).toBe("");
    expect(normalizarNome("   ")).toBe("");
    expect(normalizarNome(undefined)).toBe("");
  });
});

describe("tipoClientePeloNome", () => {
  it("razão social com LTDA/ME/EIRELI/SA vira pj", () => {
    expect(tipoClientePeloNome("DISTRIBUIDORA ROMA LTDA")).toBe("pj");
    expect(tipoClientePeloNome("COMERCIO EIRELI")).toBe("pj");
    expect(tipoClientePeloNome("ACME SERVICOS S.A.")).toBe("pj");
    expect(tipoClientePeloNome("FERRAGENS DO JOAO ME")).toBe("pj");
  });

  it("nome comum vira pf", () => {
    expect(tipoClientePeloNome("João Pereira da Silva")).toBe("pf");
    expect(tipoClientePeloNome("E-commerce")).toBe("pf");
    // "ME" só dentro de palavra não conta
    expect(tipoClientePeloNome("MERCADINHO DO CENTRO")).toBe("pf");
  });
});

describe("payloadNovoCliente", () => {
  it("monta o insert com nome, telefone, vendedor e status ativo", () => {
    const payload = payloadNovoCliente({
      nome: "  Cesar Camargo  ",
      telefone: "556234165030",
      vendedorId: "v1",
    });

    expect(payload).toEqual({
      nome_razao_social: "Cesar Camargo",
      telefone: "556234165030",
      tipo: "pf",
      status: "ativo",
      vendedor_responsavel_id: "v1",
    });
  });

  it("telefone ausente vira null e LTDA vira pj", () => {
    const payload = payloadNovoCliente({
      nome: "ROMA DISTRIBUIDORA LTDA",
      telefone: "   ",
      vendedorId: "v2",
    });

    expect(payload.telefone).toBeNull();
    expect(payload.tipo).toBe("pj");
    expect(payload.vendedor_responsavel_id).toBe("v2");
  });

  it("nome sem espaços sobrando (não cria cliente com nome em branco)", () => {
    const payload = payloadNovoCliente({ nome: "   ", vendedorId: "v3" });
    expect(payload.nome_razao_social).toBe("");
  });
});
