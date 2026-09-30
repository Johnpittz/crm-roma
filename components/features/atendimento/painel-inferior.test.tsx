// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, act, screen } from '@testing-library/react'
import { PainelInferior, type ClienteCard } from './painel-inferior'

/**
 * Card CLIENTES do atendimento: o vendedor filtra a carteira sem sair da tela.
 * A busca vai para o servidor (GET /api/clientes?busca=) com debounce —
 * filtrar só os 300 carregados mentiria para ele.
 *
 * REGRA do Top 20: o ranking de clientes (os que mais compraram) é separado
 * (GET /api/clientes/top) e o card CLIENTES pede excluir_top20=1 — quem está
 * no ranking não pode aparecer na listagem ao lado.
 */

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'token-teste' } } }),
    },
  }),
}))

// ClientList abre um modal que usa useRouter() — fora do app router do Next derruba o teste
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

function cliente(nome: string): ClienteCard {
  return {
    id: nome,
    nome_razao_social: nome,
    cpf_cnpj: null,
    telefone: null,
    email: null,
    cidade: null,
    estado: null,
    status: 'ativo',
    tipo: 'pj',
  }
}

interface TopClienteTeste {
  id: string
  nome: string
  documento: string | null
  pedidos: number
  valor: number
}

interface Payload {
  clientes: ClienteCard[]
  total: number
  top?: TopClienteTeste[]
}

/** Fetch roteado por URL: /api/clientes/top (ranking) e /api/clientes (listagem). */
function mockFetch(payload: Payload) {
  const fn = vi.fn(async (url: RequestInfo | URL) => {
    const alvo = String(url)
    if (alvo.includes('/api/clientes/top')) {
      return { ok: true, json: async () => ({ clientes: payload.top ?? [], limite: 20, escopo: 'equipe' }) }
    }
    return { ok: true, json: async () => ({ ...payload, escopo: 'equipe', limite: 300 }) }
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

/** Chamadas de fetch que batem no padrão informado (por URL). */
function chamadas(fetchMock: ReturnType<typeof vi.fn>, padrao: string) {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes(padrao))
}

/** Descarrega timers agendados + microtarefas (fetch promissado). */
async function descarregar(ms = 20) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('PainelInferior — card CLIENTES com filtro', () => {
  it('monta listando os clientes da carteira, buscando no servidor', async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch({ clientes: [cliente('Distribuidora Rio Verde LTDA')], total: 1928 })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()

    expect(document.body.textContent).toContain('Distribuidora Rio Verde LTDA')
    const listagem = chamadas(fetchMock, '/api/clientes?')
    expect(listagem).toHaveLength(1)
    const [url, init] = listagem[0] as unknown as [string, { headers: Record<string, string> }]
    expect(url).toContain('limite=300')
    expect(url).not.toContain('busca=')
    expect(init.headers.Authorization).toBe('Bearer token-teste')
  })

  it('digitar no filtro refaz a busca no servidor com o termo (debounce)', async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch({ clientes: [], total: 0 })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()
    expect(chamadas(fetchMock, '/api/clientes?')).toHaveLength(1)

    fireEvent.change(screen.getByPlaceholderText(/Filtrar por/i), {
      target: { value: 'rio verde' },
    })
    // debounce de 300ms: nada deve disparar antes
    await descarregar(100)
    expect(chamadas(fetchMock, '/api/clientes?')).toHaveLength(1)

    await descarregar(300)
    const listagem = chamadas(fetchMock, '/api/clientes?')
    expect(listagem).toHaveLength(2)
    const [url] = listagem[1] as unknown as [string]
    expect(url).toContain('busca=rio+verde')
  })

  it('mostra o total da carteira e avisa quando a lista vem truncada', async () => {
    vi.useFakeTimers()
    mockFetch({ clientes: [cliente('Padaria São João'), cliente('Mercado Ponto Certo')], total: 1928 })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()

    expect(document.body.textContent).toContain('1928')
    expect(document.body.textContent).toContain('mostrando 2 de 1928')
  })

  it('termo sem resultado mostra mensagem de "não encontrado" (não a de carteira vazia)', async () => {
    vi.useFakeTimers()
    mockFetch({ clientes: [], total: 0 })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()

    fireEvent.change(screen.getByPlaceholderText(/Filtrar por/i), {
      target: { value: 'empresa inexistente' },
    })
    await descarregar(400)

    expect(document.body.textContent).toContain('Nenhum cliente encontrado para')
    expect(document.body.textContent).not.toContain('Nenhum cliente na sua carteira')
  })

  it('a listagem CLIENTES pede ao servidor para excluir o Top 20 (regra)', async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch({ clientes: [], total: 1908 })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()

    const listagem = chamadas(fetchMock, '/api/clientes?')
    expect(listagem).toHaveLength(1)
    const [url] = listagem[0] as unknown as [string]
    expect(url).toContain('excluir_top20=1')
  })
})

describe('PainelInferior — Top 20 clientes (os que mais compraram)', () => {
  it('renderiza o ranking vindo do servidor, sem dado de exemplo', async () => {
    vi.useFakeTimers()
    mockFetch({
      clientes: [],
      total: 1928,
      top: [
        { id: 'c1', nome: 'Distribuidora Rio Verde LTDA', documento: '123', pedidos: 48, valor: 187400 },
        { id: 'c2', nome: 'Comércio São João ME', documento: null, pedidos: 45, valor: 176950 },
      ],
    })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()

    expect(document.body.textContent).toContain('Top 20 clientes')
    expect(document.body.textContent).toContain('Distribuidora Rio Verde LTDA')
    expect(document.body.textContent).toContain('48 compras')
    expect(document.body.textContent).toContain('R$ 187.400')
    expect(document.body.textContent).not.toContain('dados de exemplo')
    expect(document.body.textContent).not.toContain('melhores vendedores')
  })

  it('sem histórico de vendas mostra aviso (o card não pode fingir que tem dados)', async () => {
    vi.useFakeTimers()
    mockFetch({ clientes: [], total: 1928, top: [] })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()

    expect(document.body.textContent).toContain('Sem vendas ainda')
    expect(document.body.textContent).toContain('conclua tarefas no kanban')
    expect(document.body.textContent).not.toContain('dados de exemplo')
  })

  it('mostra a venda registrada no kanban para cliente sem cadastro', async () => {
    vi.useFakeTimers()
    mockFetch({
      clientes: [],
      total: 0,
      top: [
        { id: 'sem-cadastro:e-commerce', nome: 'E-commerce', documento: null, pedidos: 2, valor: 1500 },
      ],
    })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()

    expect(document.body.textContent).toContain('E-commerce')
    expect(document.body.textContent).toContain('2 compras')
    expect(document.body.textContent).toContain('R$ 1.500')
  })

  it('busca o ranking uma única vez na carga inicial', async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch({ clientes: [], total: 1928, top: [] })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()

    expect(chamadas(fetchMock, '/api/clientes/top')).toHaveLength(1)

    fireEvent.change(screen.getByPlaceholderText(/Filtrar por/i), { target: { value: 'rio' } })
    await descarregar(400)

    expect(chamadas(fetchMock, '/api/clientes/top')).toHaveLength(1)
    expect(chamadas(fetchMock, '/api/clientes?')).toHaveLength(2)
  })
})
