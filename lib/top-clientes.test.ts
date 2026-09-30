import { describe, it, expect } from "vitest";
import {
  agregarVendasPorCliente,
  agregarTarefasPorCliente,
  mesclarAcumulos,
  aplicarResolucaoDeNomes,
  idsReaisParaExcluir,
  ordenarIdsRanking,
  montarRanking,
  TOP_CLIENTES_LIMITE,
  type VendaRankingLinha,
  type TarefaVendaLinha,
} from "./top-clientes";

/**
 * TOP 20 CLIENTES (os que mais compraram) — regra do card de Atendimento:
 *  - ranking por valor total comprado (desempate por nº de pedidos);
 *  - quem entra no Top 20 sai da listagem CLIENTES (GET /api/clientes?excluir_top20=1).
 * Duas fontes: `vendas` (integração Millennium, hoje vazia) e `tarefas` com
 * resultado=sucesso + valor_venda (o que o time registra no kanban).
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

// ── Fonte: vendas registradas no TAREFAS/KANBAN ──

function tarefa(
  refs: { cliente_id?: string | null; cliente_nome?: string | null },
  valor: number | null,
  resultado = "sucesso"
): TarefaVendaLinha {
  return {
    cliente_id: refs.cliente_id ?? null,
    cliente_nome: refs.cliente_nome ?? null,
    valor_venda: valor,
    resultado,
  };
}

describe("agregarTarefasPorCliente (vendas registradas no kanban)", () => {
  it("conta só o que é venda: resultado sucesso e valor_venda > 0", () => {
    const agg = agregarTarefasPorCliente([
      tarefa({ cliente_id: "c1" }, 200),
      tarefa({ cliente_id: "c1" }, 50),
      tarefa({ cliente_id: "c1" }, 900, "insucesso"),
      tarefa({ cliente_id: "c1" }, 0),
      tarefa({ cliente_id: "c1" }, null),
    ]);

    expect(agg.size).toBe(1);
    expect(agg.get("c1")).toEqual({ pedidos: 2, valor: 250 });
  });

  it("sem cliente vinculado usa o nome da tarefa como chave", () => {
    const agg = agregarTarefasPorCliente([
      tarefa({ cliente_nome: "  E-commerce " }, 1000),
      tarefa({ cliente_nome: "e-Commerce" }, 500),
      tarefa({ cliente_nome: null }, 700),
    ]);

    expect(agg.size).toBe(1);
    expect(agg.get("nome:e-commerce")).toEqual({ pedidos: 2, valor: 1500, nome: "E-commerce" });
  });
});

describe("mesclarAcumulos", () => {
  it("soma a venda do ERP com a venda registrada no kanban", () => {
    const erp = agregarVendasPorCliente([venda("c1", 100)]);
    const kanban = agregarTarefasPorCliente([tarefa({ cliente_id: "c1" }, 300)]);

    const merged = mesclarAcumulos(erp, kanban);
    expect(merged.get("c1")).toEqual({ pedidos: 2, valor: 400 });
  });

  it("chave de nome que ainda não virou cliente fica separada", () => {
    const merged = mesclarAcumulos(
      agregarVendasPorCliente([venda("c1", 100)]),
      agregarTarefasPorCliente([tarefa({ cliente_nome: "E-commerce" }, 300)])
    );

    expect(merged.size).toBe(2);
  });
});

describe("aplicarResolucaoDeNomes", () => {
  it("funde a chave de nome no cliente encontrado e soma as duas contas", () => {
    const agg = mesclarAcumulos(
      agregarVendasPorCliente([venda("uuid-real", 100)]),
      agregarTarefasPorCliente([tarefa({ cliente_nome: "EDGAR PEREIRA" }, 400)])
    );

    const resolvido = aplicarResolucaoDeNomes(agg, { "nome:edgar pereira": "uuid-real" });

    expect(resolvido.get("nome:edgar pereira")).toBeUndefined();
    expect(resolvido.get("uuid-real")).toEqual({ pedidos: 2, valor: 500 });
  });

  it("nome que não bate com nenhum cliente segue no ranking como está", () => {
    const agg = agregarTarefasPorCliente([tarefa({ cliente_nome: "E-commerce" }, 1000)]);

    const resolvido = aplicarResolucaoDeNomes(agg, { "nome:e-commerce": null });

    expect(resolvido.get("nome:e-commerce")).toEqual({ pedidos: 1, valor: 1000, nome: "E-commerce" });
  });
});

describe("idsReaisParaExcluir (regra do card CLIENTES)", () => {
  it("só leva uuid de cliente — sem cadastro não pode ir para o SQL", () => {
    const ranking = [
      { id: "9fdb1ffb-91ee-40b0-9195-4e8609a12b81", nome: "Alpha", documento: null, pedidos: 1, valor: 100 },
      { id: "sem-cadastro:e-commerce", nome: "E-commerce", documento: null, pedidos: 1, valor: 900 },
    ];

    expect(idsReaisParaExcluir(ranking)).toEqual(["9fdb1ffb-91ee-40b0-9195-4e8609a12b81"]);
  });
});

describe("montarRanking com venda vinda do kanban", () => {
  it("item sem cadastro aparece com id sintético e o nome original", () => {
    const agg = agregarTarefasPorCliente([tarefa({ cliente_nome: "E-commerce" }, 1000)]);

    const ranking = montarRanking(ordenarIdsRanking(agg, TOP_CLIENTES_LIMITE), [], agg);

    expect(ranking).toHaveLength(1);
    expect(ranking[0]).toEqual({
      id: "sem-cadastro:e-commerce",
      nome: "E-commerce",
      documento: null,
      pedidos: 1,
      valor: 1000,
    });
  });

  it("venda do kanban e venda do ERP disputam a mesma ordem", () => {
    const agg = mesclarAcumulos(
      agregarVendasPorCliente([venda("c-erp", 500)]),
      agregarTarefasPorCliente([tarefa({ cliente_id: "c-kanban" }, 900)])
    );

    const ranking = montarRanking(
      ordenarIdsRanking(agg, TOP_CLIENTES_LIMITE),
      [
        { id: "c-erp", nome_razao_social: "ERP Ltda", cpf_cnpj: null },
        { id: "c-kanban", nome_razao_social: "Kanban ME", cpf_cnpj: null },
      ],
      agg
    );

    expect(ranking.map((r) => r.nome)).toEqual(["Kanban ME", "ERP Ltda"]);
  });
});
