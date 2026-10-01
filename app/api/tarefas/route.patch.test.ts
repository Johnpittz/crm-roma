// @vitest-environment node
/**
 * REGRA (01/10/2026, pedido do João): quando alguém FECHA uma tarefa de cliente
 * que ainda não existe na base, o servidor pré-cadastra o cliente com o que temos
 * do WhatsApp (nome + telefone) e vincula a tarefa a ele — lead que virou venda
 * vira cliente "pré-criado", com o resto dos dados preenchido depois.
 *
 * Antes disso só o POST fazia o cadastro; quem concluía uma tarefa antiga
 * (criada antes do deploy de 30/09) ficava com `cliente_id = null` e a venda
 * dele não era reconhecida como cliente nenhum.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const ctx = vi.hoisted(() => {
  const estado: any = {
    tarefas: [] as any[],
    clientes: [] as any[],
    profiles: [] as any[],
    falharInsertClientes: false,
  };

  function novaQuery(tabela: string) {
    const filtros: ((l: any) => boolean)[] = [];
    let ordem: { col: string; asc: boolean } | null = null;
    let limite = 1000;
    let offset = 0;
    let head = false;
    let insertPayload: any = null;
    let updatePayload: any = null;

    const filtradas = () => (estado[tabela] || []).filter((l: any) => filtros.every((f) => f(l)));
    const projetar = () => {
      const linhas = [...filtradas()];
      if (ordem) {
        linhas.sort((a: any, b: any) => {
          const c = String(a[ordem!.col] ?? "").localeCompare(String(b[ordem!.col] ?? ""), "pt-BR");
          return ordem!.asc ? c : -c;
        });
      }
      return linhas.slice(offset, offset + limite);
    };

    const executar = (): { data: any; error: any; count: number | null } => {
      if (insertPayload) {
        if (estado.falharInsertClientes && tabela === "clientes") {
          return { data: null, error: { message: "violou regra de negocio" }, count: null };
        }
        const linha = { id: `${tabela}-novo-${estado[tabela].length + 1}`, ...insertPayload };
        estado[tabela].push(linha);
        return { data: [linha], error: null, count: null };
      }
      if (updatePayload) {
        const alvos = filtradas();
        alvos.forEach((l: any) => Object.assign(l, updatePayload));
        return { data: alvos, error: null, count: null };
      }
      if (head) return { data: null, error: null, count: filtradas().length };
      return { data: projetar(), error: null, count: null };
    };

    const q: any = {
      select: (_c?: string, opts?: any) => {
        if (opts?.head) head = true;
        return q;
      },
      insert: (d: any) => {
        insertPayload = d;
        return q;
      },
      update: (d: any) => {
        updatePayload = d;
        return q;
      },
      eq: (c: string, v: any) => {
        filtros.push((l) => l[c] === v);
        return q;
      },
      ilike: (c: string, p: string) => {
        const rx = new RegExp(
          "^" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$",
          "i"
        );
        filtros.push((l) => rx.test(String(l[c] ?? "")));
        return q;
      },
      limit: (n: number) => {
        limite = n;
        return q;
      },
      order: (c: string, o?: any) => {
        ordem = { col: c, asc: o?.ascending !== false };
        return q;
      },
      range: (a: number, b: number) => {
        offset = a;
        limite = b - a + 1;
        return q;
      },
      single: async () => {
        const r = executar();
        const linha = Array.isArray(r.data) ? r.data[0] : r.data;
        return linha ? { data: linha, error: null } : { data: null, error: r.error || { message: "0 linhas" } };
      },
      then: (ok: any, erro: any) => Promise.resolve(executar()).then(ok, erro),
    };
    return q;
  }

  const db = () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    from: (tabela: string) => novaQuery(tabela),
  });

  return { estado, db };
});

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ctx.db() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ctx.db() }));

import { PATCH } from "./route";

function reiniciar() {
  ctx.estado.tarefas = [
    {
      id: "t1",
      titulo: "MANDAR ORCAMENTO",
      cliente_nome: "E-commerce",
      cliente_id: null,
      vendedor_id: "user-1",
      coluna_kanban: "a_fazer",
      status: "pendente",
      resultado: null,
      valor_venda: null,
    },
  ];
  ctx.estado.clientes = [];
  ctx.estado.profiles = [{ id: "user-1", cargo: "gerente_comercial", gestor_id: "user-1" }];
  ctx.estado.falharInsertClientes = false;
}

function chamar(body: Record<string, unknown>) {
  return PATCH({ json: async () => body } as any);
}

describe("PATCH /api/tarefas — pré-cadastro do cliente ao concluir", () => {
  beforeEach(() => reiniciar());

  it("fechar tarefa de cliente sem cadastro cria o cliente (nome + telefone do WhatsApp) e vincula", async () => {
    const res = await chamar({
      id: "t1",
      coluna_kanban: "concluida",
      status: "concluida",
      resultado: "sucesso",
      valor_venda: 1000,
      telefone: "556234165003",
    });

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.success).toBe(true);

    // RED: hoje a rota só atualiza a tarefa e deixa ela sem cliente
    expect(ctx.estado.clientes).toHaveLength(1);
    expect(ctx.estado.clientes[0].nome_razao_social).toBe("E-commerce");
    expect(ctx.estado.clientes[0].telefone).toBe("556234165003");
    expect(ctx.estado.clientes[0].vendedor_responsavel_id).toBe("user-1");

    // a tarefa passa a apontar para o cliente recém-criado
    expect(ctx.estado.tarefas[0].cliente_id).toBe(ctx.estado.clientes[0].id);
    // e a conclusão em si continua acontecendo
    expect(ctx.estado.tarefas[0].coluna_kanban).toBe("concluida");
    expect(ctx.estado.tarefas[0].valor_venda).toBe(1000);
  });

  it("cliente com o mesmo nome já existe: vincula sem criar duplicado", async () => {
    ctx.estado.clientes.push({ id: "c-ecom", nome_razao_social: "E-COMMERCE", telefone: null });

    await chamar({ id: "t1", coluna_kanban: "concluida", resultado: "sucesso", valor_venda: 500 });

    expect(ctx.estado.clientes).toHaveLength(1);
    expect(ctx.estado.tarefas[0].cliente_id).toBe("c-ecom");
  });

  it("tarefa já vinculada não mexe na base de clientes", async () => {
    ctx.estado.clientes.push({ id: "c-antigo", nome_razao_social: "Outro Cliente" });
    ctx.estado.tarefas[0].cliente_id = "c-antigo";

    await chamar({ id: "t1", coluna_kanban: "concluida", resultado: "sucesso", valor_venda: 1000 });

    expect(ctx.estado.clientes).toHaveLength(1);
    expect(ctx.estado.tarefas[0].cliente_id).toBe("c-antigo");
  });

  it("falha no cadastro NUNCA bloqueia a conclusão (dá erro no log e segue)", async () => {
    ctx.estado.falharInsertClientes = true;

    const res = await chamar({ id: "t1", coluna_kanban: "concluida", resultado: "sucesso", valor_venda: 1000 });
    const corpo = await res.json();

    expect(corpo.success).toBe(true);
    expect(ctx.estado.tarefas[0].coluna_kanban).toBe("concluida");
    expect(ctx.estado.tarefas[0].cliente_id).toBeNull();
    expect(ctx.estado.clientes).toHaveLength(0);
  });
});
