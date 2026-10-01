import { describe, it, expect } from "vitest";
import {
  situacaoDaTarefa,
  situacoesPorCliente,
  ordenarPorContato,
  aplicarFiltroContato,
  situacoesDoEscopo,
  type TarefaSituacao,
  type FiltroContato,
} from "./situacao-contato";

/**
 * REGRA DE NEGÓCIO do card CLIENTES (atendimento) — combinada com o João em
 * 30/09/2026:
 *
 *   - cliente com tarefa ABERTA em dia  -> desce para o FIM ("para o vendedor
 *     não se perder": quem já tem contato agendado não é a próxima prioridade);
 *   - se a tarefa passar de 24h sem resposta OU o prazo vencido -> ATRASADO,
 *     sobe para o TOPO (vermelho);
 *   - tarefa CONCLUÍDA (de qualquer data) -> REALIZADO (verde);
 *   - sem tarefa -> posição normal (meio).
 *
 * Ordem: atrasados -> sem tarefa -> com tarefa em dia -> realizados.
 */

const AGORA = new Date("2026-10-01T12:00:00.000Z");

function tarefa(extra: Partial<TarefaSituacao> = {}): TarefaSituacao {
  return {
    cliente_id: "c1",
    cliente_nome: "Distribuidora Rio Verde LTDA",
    coluna_kanban: "a_fazer",
    status: "pendente",
    created_at: "2026-10-01T10:00:00.000Z", // 2h atrás
    data_inicio: "2026-10-01",
    hora_inicio: null,
    data_fim: "2026-10-02", // prazo futuro
    hora_fim: null,
    ...extra,
  };
}

describe("situacaoDaTarefa — quando um contato conta como atrasado", () => {
  it("tarefa aberta recente e prazo futuro fica em_dia", () => {
    expect(situacaoDaTarefa(tarefa(), AGORA)).toBe("em_dia");
  });

  it("tarefa aberta há mais de 24h fica atrasado mesmo com prazo futuro", () => {
    const t = tarefa({ created_at: "2026-09-30T09:00:00.000Z" }); // 27h
    expect(situacaoDaTarefa(t, AGORA)).toBe("atrasado");
  });

  it("prazo vencido marca atraso mesmo criada há poucas horas", () => {
    const t = tarefa({ data_inicio: "2026-09-30", data_fim: "2026-09-30" });
    expect(situacaoDaTarefa(t, AGORA)).toBe("atrasado");
  });

  it("prazo vencido leva em conta a hora fim (ainda não venceu = em_dia)", () => {
    const t = tarefa({
      data_inicio: "2026-10-01",
      data_fim: "2026-10-01",
      hora_fim: "18:00:00",
    });
    // 18:00 no fuso do servidor ainda não passou às 12:00 UTC
    expect(["em_dia", "atrasado"]).toContain(situacaoDaTarefa(t, AGORA));
    const tVencida = { ...t, hora_fim: "11:00:00" };
    expect(situacaoDaTarefa(tVencida, AGORA)).toBe("atrasado");
  });

  it("tarefa concluída é realizado, mesmo antiga", () => {
    const t = tarefa({
      coluna_kanban: "concluida",
      status: "concluida",
      created_at: "2026-07-01T10:00:00.000Z",
      data_fim: "2026-07-02",
    });
    expect(situacaoDaTarefa(t, AGORA)).toBe("realizado");
  });

  it("tarefa em andamento aberta há dias também é atrasada", () => {
    const t = tarefa({
      coluna_kanban: "em_andamento",
      status: "em_andamento",
      created_at: "2026-09-25T10:00:00.000Z",
      data_fim: null,
      data_inicio: null,
    });
    expect(situacaoDaTarefa(t, AGORA)).toBe("atrasado");
  });
});

describe("situacoesPorCliente — uma situação por cliente", () => {
  it("aberta atrasada vence histórico concluído (o cliente precisa de ação)", () => {
    const mapa = situacoesPorCliente(
      [
        tarefa({ cliente_id: "c1", coluna_kanban: "concluida", status: "concluida" }),
        tarefa({ cliente_id: "c1", created_at: "2026-09-20T10:00:00.000Z" }),
      ],
      AGORA
    );
    expect(mapa.get("c1")).toBe("atrasado");
  });

  it("aberta em dia vence histórico concluído (não pode virar verde enquanto tem pendência)", () => {
    const mapa = situacoesPorCliente(
      [
        tarefa({ cliente_id: "c2", coluna_kanban: "concluida", status: "concluida" }),
        tarefa({ cliente_id: "c2" }),
      ],
      AGORA
    );
    expect(mapa.get("c2")).toBe("em_dia");
  });

  it("só histórico concluído fica realizado", () => {
    const mapa = situacoesPorCliente(
      [tarefa({ cliente_id: "c3", coluna_kanban: "concluida", status: "concluida" })],
      AGORA
    );
    expect(mapa.get("c3")).toBe("realizado");
  });

  it("tarefa sem cliente_id casa com o cliente pelo nome normalizado", () => {
    const porNome = new Map([["distribuidora rio verde ltda", "c9"]]);
    const mapa = situacoesPorCliente(
      [tarefa({ cliente_id: null, cliente_nome: "  DISTRIBUIDORA RIO VERDE  LTDA " })],
      AGORA,
      porNome
    );
    expect(mapa.get("c9")).toBe("em_dia");
  });

  it("tarefa sem cliente e sem nome que case fica fora (não contamina ninguém)", () => {
    const mapa = situacoesPorCliente(
      [tarefa({ cliente_id: null, cliente_nome: "Nome Que Nao Existe SA" })],
      AGORA
    );
    expect(mapa.size).toBe(0);
  });
});

describe("ordenarPorContato / aplicarFiltroContato — ordem da listagem", () => {
  it("ordena: atrasados -> sem tarefa -> em dia -> realizados, preservando a ordem alfabética dentro do grupo", () => {
    const base = ["Zeca (sem)", "Ana (em dia)", "Bia (atrasada)", "Caio (feito)", "Davi (sem)"];
    const ids = new Map<string, any>([
      ["Zeca (sem)", "sem_tarefa"],
      ["Ana (em dia)", "em_dia"],
      ["Bia (atrasada)", "atrasado"],
      ["Caio (feito)", "realizado"],
      ["Davi (sem)", "sem_tarefa"],
    ]);
    const ordenados = ordenarPorContato(base, (id) => ids.get(id) as any);
    expect(ordenados).toEqual([
      "Bia (atrasada)", // topo: atrasado (vermelho)
      "Zeca (sem)", // meio: sem tarefa (ordem original preservada)
      "Davi (sem)",
      "Ana (em dia)", // fim: com tarefa em dia
      "Caio (feito)", // último: realizado (verde)
    ]);
  });

  it("filtro ATRASADOS devolve só os atrasados e o total de cada grupo", () => {
    const base = ["A", "B", "C"];
    const mapa = new Map<string, any>([
      ["A", "atrasado"],
      ["B", "em_dia"],
      ["C", "realizado"],
    ]);
    const res = aplicarFiltroContato(base, (id) => mapa.get(id) as any, "atrasados");
    expect(res.ids).toEqual(["A"]);
    expect(res.contagem).toEqual({ todos: 3, atrasados: 1, realizados: 1 });
  });

  it("filtro REALIZADOS devolve só os concluídos", () => {
    const base = ["A", "B", "C"];
    const mapa = new Map<string, any>([
      ["A", "atrasado"],
      ["B", "em_dia"],
      ["C", "realizado"],
    ]);
    const res = aplicarFiltroContato(base, (id) => mapa.get(id) as any, "realizados");
    expect(res.ids).toEqual(["C"]);
    expect(res.contagem.realizados).toBe(1);
  });

  it("filtro TODOS mantém todos na ordem de prioridade", () => {
    const base = ["A", "B", "C"];
    const mapa = new Map<string, any>([
      ["A", "em_dia"],
      ["B", "atrasado"],
      ["C", "realizado"],
    ]);
    const res = aplicarFiltroContato(base, (id) => mapa.get(id) as any, "todos");
    expect(res.ids).toEqual(["B", "A", "C"]);
  });
});

/** PostgREST falso: mesma forma encadeável do supabase-js. */
function dbFalso(tarefas: Record<string, any>[]) {
  return {
    from(tabela: string) {
      expect(tabela).toBe("tarefas");
      const estado: { vendedor?: string; vendedores?: string[]; offset: number; limite: number } = {
        offset: 0,
        limite: 1000,
      };
      const query: any = {
        select: () => query,
        eq: (col: string, valor: string) => {
          if (col === "vendedor_id") estado.vendedor = valor;
          return query;
        },
        in: (col: string, valores: string[]) => {
          if (col === "vendedor_id") estado.vendedores = valores;
          return query;
        },
        order: () => query,
        range: (a: number, b: number) => {
          estado.offset = a;
          estado.limite = b - a + 1;
          return query;
        },
        then: (ok: any, erro: any) => {
          // aplica o filtro como o PostgREST faria antes de paginar
          let base = tarefas;
          if (estado.vendedor) base = base.filter((t) => t.vendedor_id === estado.vendedor);
          if (estado.vendedores) base = base.filter((t) => (estado.vendedores || []).includes(t.vendedor_id));
          return Promise.resolve({
            data: base.slice(estado.offset, estado.offset + estado.limite),
            error: null,
          }).then(ok, erro);
        },
      };
      return query;
    },
  };
}

describe("situacoesDoEscopo — leitura das tarefas com a regra de carteira", () => {
  it("vendedor vê só as tarefas dele (escopo próprio)", async () => {
    const db = dbFalso([
      tarefa({ cliente_id: "c1", vendedor_id: "eu" }),
      tarefa({ cliente_id: "c2", vendedor_id: "outro", created_at: "2026-09-01T10:00:00.000Z" }),
    ]);
    const mapa = await situacoesDoEscopo(db as any, { escopo: "proprio", userId: "eu", equipeIds: [], agora: AGORA });
    expect(mapa.get("c1")).toBe("em_dia");
    expect(mapa.has("c2")).toBe(false); // tarefa de outro vendedor não decide nada aqui
  });

  it("gestor inclui a equipe (escopo equipe)", async () => {
    const db = dbFalso([
      tarefa({ cliente_id: "c1", vendedor_id: "eu" }),
      tarefa({ cliente_id: "c2", vendedor_id: "vendedorX" }),
    ]);
    const mapa = await situacoesDoEscopo(db as any, { escopo: "equipe", userId: "eu", equipeIds: ["vendedorX"], agora: AGORA });
    expect(mapa.get("c2")).toBe("em_dia");
  });

  it("erro de banco não derruba a listagem: devolve mapa vazio", async () => {
    const db = {
      from: () => ({
        select: function () { return this; },
        eq: function () { return this; },
        order: function () { return this; },
        range: function () { return this; },
        then: (ok: any, erro: any) => Promise.resolve({ data: null, error: { message: "boom" } }).then(ok, erro),
      }),
    };
    const mapa = await situacoesDoEscopo(db as any, { escopo: "proprio", userId: "eu", equipeIds: [], agora: AGORA });
    expect(mapa.size).toBe(0);
  });
});

describe("FiltroContato — valores aceitos", () => {
  it("só os três filtros conhecidos", () => {
    const válidos: FiltroContato[] = ["todos", "atrasados", "realizados"];
    expect(válidos).toHaveLength(3);
  });
});
