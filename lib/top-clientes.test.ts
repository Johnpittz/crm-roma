import { describe, it, expect } from "vitest";
import {
  agregarVendasPorCliente,
  ordenarIdsRanking,
  montarRanking,
  TOP_CLIENTES_LIMITE,
  type VendaRankingLinha,
} from "./top-clientes";

/**
 * TOP 20 CLIENTES (os que mais compraram) — regra do card de Atendimento:
 *  - ranking por valor total comprado (desempate por nº de pedidos);
 *  - quem entra no Top 20 sai da listagem CLIENTES (GET /api/clientes?excluir_top20=1).
 * Aqui ficam as partes puras: agregação, ordenação e montagem da lista.
 */

function venda(
  cliente_id: string | null,
  valor: number,
  extra: Partial<VendaRankingLinha> = {}
): VendaRankingLinha {
  return { cliente_id, valor_final: valor, valor_total: valor, status: "confirmada", ...extra };
}

describe("agregarVendasPorCliente", () => {
  it("soma o valor e conta os pedidos de cada cliente", () => {
    const agg = agregarVendasPorCliente([
      venda("c1", 100),
      venda("c1", 250),
      venda("c2", 90),
    ]);

    expect(agg.get("c1")).toEqual({ pedidos: 2, valor: 350 });
    expect(agg.get("c2")).toEqual({ pedidos: 1, valor: 90 });
  });

  it("ignora venda sem cliente vinculado e venda cancelada", () => {
    const agg = agregarVendasPorCliente([
      venda(null, 999),
      venda("c1", 100),
      venda("c2", 500, { status: "cancelada" }),
    ]);

    expect(agg.size).toBe(1);
    expect(agg.get("c1")).toEqual({ pedidos: 1, valor: 100 });
  });

  it("usa valor_final e cai para valor_total quando o final está zerado/nulo", () => {
    const agg = agregarVendasPorCliente([
      venda("c1", 0, { valor_final: null, valor_total: 120 }),
      venda("c2", 0, { valor_final: 0, valor_total: 0 }),
    ]);

    expect(agg.get("c1")?.valor).toBe(120);
    expect(agg.get("c2")?.valor).toBe(0);
  });
});

describe("ordenarIdsRanking", () => {
  it("ordena por valor comprado e corta no limite", () => {
    const agg = agregarVendasPorCliente([
      venda("c1", 100),
      venda("c2", 500),
      venda("c3", 300),
      venda("c4", 50),
    ]);

    expect(ordenarIdsRanking(agg, 3)).toEqual(["c2", "c3", "c1"]);
  });

  it("desempata por nº de pedidos quando o valor é igual", () => {
    const agg = agregarVendasPorCliente([
      venda("c1", 200),
      venda("c2", 200),
      venda("c2", 200),
    ]);

    expect(ordenarIdsRanking(agg, 2)).toEqual(["c2", "c1"]);
  });

  it("padrão de 20 posições", () => {
    const agg = agregarVendasPorCliente(
      Array.from({ length: 30 }, (_, i) => venda(`c${i}`, (30 - i) * 10))
    );

    expect(ordenarIdsRanking(agg, TOP_CLIENTES_LIMITE)).toHaveLength(20);
  });
});

describe("montarRanking", () => {
  it("monta a lista na ordem do ranking com nome, pedidos e valor", () => {
    const agg = agregarVendasPorCliente([
      venda("c2", 500),
      venda("c1", 100),
    ]);
    const ranking = montarRanking(
      ordenarIdsRanking(agg, 2),
      [
        { id: "c1", nome_razao_social: "Alpha Comércio", cpf_cnpj: "111" },
        { id: "c2", nome_razao_social: "Beta Distribuidora", cpf_cnpj: null },
      ],
      agg
    );

    expect(ranking.map((r) => r.nome)).toEqual(["Beta Distribuidora", "Alpha Comércio"]);
    expect(ranking[0]).toMatchObject({ pedidos: 1, valor: 500, documento: null });
    expect(ranking[1]).toMatchObject({ pedidos: 1, valor: 100, documento: "111" });
  });

  it("pula id sem linha de cliente (não pode quebrar o card)", () => {
    const agg = agregarVendasPorCliente([
      venda("c1", 100),
      venda("c2", 90),
    ]);
    const ranking = montarRanking(["c2", "c1"], [{ id: "c1", nome_razao_social: "Alpha" }], agg);

    expect(ranking).toHaveLength(1);
    expect(ranking[0].id).toBe("c1");
  });
});
