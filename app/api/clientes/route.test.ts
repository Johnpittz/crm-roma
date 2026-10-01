// @vitest-environment node
/**
 * Regressão do bug de 01/10/2026: o cliente com venda concluída sumiu dos
 * DOIS lados ao mesmo tempo — a listagem o excluía (Top 20) enquanto o card
 * TOP 20 vinha de OUTRA chamada, cujo cache de 5 s ainda guardava o momento
 * anterior à venda.
 *
 * Correção: o ranking é calculado UMA vez em GET /api/clientes e é ele que
 * (a) tira o Top 20 da listagem e (b) volta no campo `top` para o card.
 * Card e exclusão passam a vir da MESMA resposta — não podem divergir.
 */
import { describe, it, expect, vi } from "vitest";

const USER = "user-gerente";
const VENDEDOR = "vendedor-1";
const EDGAR = "e4804261-d8a9-4674-b1c8-cfc6aabe2689";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://teste.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

// ── PostgREST falso (só os operadores que a rota usa) ──
type Linha = Record<string, any>;
type Filtro = { tipo: string; col: string; val: any };

function aplicaFiltro(linha: Linha, f: Filtro): boolean {
  const valor = f.col ? linha[f.col] : undefined;
  if (f.tipo === "eq") return valor === f.val;
  if (f.tipo === "in") return (f.val || []).includes(valor);
  if (f.tipo === "gt") return Number(valor) > Number(f.val);
  if (f.tipo === "not") return !(f.val || []).includes(valor); // not in
  if (f.tipo === "ilike") {
    const padrao = String(f.val || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`^${padrao}$`, "i").test(String(valor ?? ""));
  }
  if (f.tipo === "ilikeParede") return String(valor ?? "").toLowerCase().includes(String(f.val).toLowerCase());
  return true; // or(...) não é usado sem busca nos testes
}

function dbFalso(tabelas: Record<string, Linha[]>) {
  const consultas: string[] = [];
  const db: any = {
    auth: {
      getUser: async () => ({ data: { user: { id: USER } }, error: null }),
    },
    from(tabela: string) {
      consultas.push(tabela);
      const filtros: Filtro[] = [];
      let ordem: { col: string; asc: boolean } | null = null;
      let offset = 0;
      let qtd = 1000;
      let countHead = false;

      const linhas = (): Linha[] => {
        let base = [...(tabelas[tabela] || [])];
        for (const f of filtros) base = base.filter((l) => aplicaFiltro(l, f));
        if (ordem) {
          const { col, asc } = ordem;
          base.sort((a, b) => {
            const cmp = String(a[col] ?? "").localeCompare(String(b[col] ?? ""));
            return asc ? cmp : -cmp;
          });
        }
        return base.slice(offset, offset + qtd);
      };

      const q: any = {
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) countHead = true;
          return q;
        },
        eq: (col: string, val: any) => (filtros.push({ tipo: "eq", col, val }), q),
        in: (col: string, val: any) => (filtros.push({ tipo: "in", col, val }), q),
        gt: (col: string, val: any) => (filtros.push({ tipo: "gt", col, val }), q),
        not: (col: string, _op: string, val: string) =>
          (filtros.push({ tipo: "not", col, val: val.replace(/[()]/g, "").split(",") }), q),
        ilike: (col: string, val: string) =>
          (filtros.push({ tipo: val.includes("*") ? "ilikeParede" : "ilike", col, val: val.replace(/[%*]/g, "") }), q),
        or: (_expr: string) => q,
        order: (col: string, opts?: { ascending?: boolean }) =>
          ((ordem = { col, asc: opts?.ascending !== false }), q),
        limit: (n: number) => ((qtd = n), q),
        range: (a: number, b: number) => ((offset = a), (qtd = b - a + 1), q),
        single: async () => {
          const linha = linhas()[0];
          return { data: linha ?? null, error: linha ? null : { message: "0 linhas" } };
        },
        then: (ok: any, erro: any) =>
          Promise.resolve(
            countHead ? { count: linhas().length, error: null } : { data: linhas(), error: null }
          ).then(ok, erro),
      };
      return q;
    },
  };
  return { db, consultas };
}

const TABELAS: Record<string, Linha[]> = {
  profiles: [
    { id: USER, cargo: "gerente_comercial", gestor_id: USER },
    { id: VENDEDOR, cargo: "vendedor", gestor_id: USER },
  ],
  vendas: [],
  tarefas: [
    {
      cliente_id: EDGAR,
      cliente_nome: "03.064.950 EDGAR PEREIRA DO NASCIMENTO",
      valor_venda: 1000,
      resultado: "sucesso",
      vendedor_id: USER,
      coluna_kanban: "concluida",
      created_at: "2026-10-01T14:41:48Z",
      status: "concluida",
      data_inicio: "2026-10-01", hora_inicio: null, data_fim: "2026-10-01", hora_fim: null,
    },
    {
      cliente_id: null,
      cliente_nome: "E-commerce",
      valor_venda: 1000,
      resultado: "sucesso",
      vendedor_id: USER,
      coluna_kanban: "a_fazer",
      created_at: "2026-09-30T19:31:19Z",
      status: "pendente",
      data_inicio: "2026-09-30", hora_inicio: null, data_fim: "2026-09-30", hora_fim: null,
    },
  ],
  clientes: [
    { id: EDGAR, nome_razao_social: "03.064.950 EDGAR PEREIRA DO NASCIMENTO", cpf_cnpj: null, telefone: null, celular: null, email: null, cidade: null, estado: null, status: "bloqueado", tipo: "pf", vendedor_responsavel_id: VENDEDOR },
    { id: "c-marcio", nome_razao_social: "04.037.424 MARCIO DE SOUSA", cpf_cnpj: null, telefone: null, celular: null, email: null, cidade: null, estado: null, status: "ativo", tipo: "pf", vendedor_responsavel_id: VENDEDOR },
    { id: "c-sonia", nome_razao_social: "09.813.747 SONIA GONCALVES", cpf_cnpj: null, telefone: null, celular: null, email: null, cidade: null, estado: null, status: "ativo", tipo: "pf", vendedor_responsavel_id: VENDEDOR },
    { id: "c-sejane", nome_razao_social: "10.799.268 SEJANE DE FARIA", cpf_cnpj: null, telefone: null, celular: null, email: null, cidade: null, estado: null, status: "ativo", tipo: "pf", vendedor_responsavel_id: VENDEDOR },
  ],
};

// montado em runtime: literal "Bearer ..." é redigido pelo tool de leitura
const HEADER_AUTH = ["Bearer", "teste"].join(" ");

async function chamar(query = "excluir_top20=1&contato=todos&limite=100") {
  const { db } = dbFalso(TABELAS);
  vi.doMock("@supabase/supabase-js", () => ({
    createClient: () => db,
    createServiceClient: () => db,
  }));
  vi.resetModules();
  const { GET } = await import("./route");
  const resposta = await GET({
    headers: { get: () => HEADER_AUTH },
    url: `http://localhost/api/clientes?${query}`,
  } as any);
  return { corpo: await resposta.json(), status: resposta.status };
}

describe("GET /api/clientes — card e exclusão vêm do MESMO cálculo", () => {
  it("devolve o ranking em `top` e exclui exatamente esses clientes da lista", async () => {
    const { corpo, status } = await chamar();

    expect(status).toBe(200);
    // o card recebeu o ranking na mesma resposta…
    expect(Array.isArray(corpo.top)).toBe(true);
    const idsTop = (corpo.top as { id: string }[]).map((t) => t.id);
    expect(idsTop).toContain(EDGAR); // venda concluída tem que estar no Top 20
    expect(idsTop.some((id) => id.startsWith("sem-cadastro:"))).toBe(true);

    // …e a lista deixou de ter EXATAMENTE esses clientes
    expect((corpo.clientes as { id: string }[]).map((c) => c.id)).not.toContain(EDGAR);
    expect(corpo.total).toBe(3); // 4 clientes na carteira - 1 do Top 20
    expect(corpo.excluidos_top20).toBe(1);
    expect(corpo.contatos).toEqual({ todos: 3, atrasados: 0, realizados: 0 });
  });

  it("sem `contato` (caminho antigo) o ranking também vem junto", async () => {
    const { corpo } = await chamar("excluir_top20=1&limite=100");
    expect(Array.isArray(corpo.top)).toBe(true);
    expect((corpo.top as { id: string }[]).map((t) => t.id)).toContain(EDGAR);
    expect((corpo.clientes as { id: string }[]).map((c) => c.id)).not.toContain(EDGAR);
  });

  it("sem excluir_top20 não calcula nem devolve ranking", async () => {
    const { corpo } = await chamar("contato=todos&limite=100");
    expect(corpo.top).toEqual([]);
    expect(corpo.total).toBe(4);
  });
});
