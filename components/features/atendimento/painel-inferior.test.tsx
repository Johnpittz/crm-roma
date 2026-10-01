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

function cliente(nome: string, contato?: 'atrasado' | 'realizado' | 'em_dia' | 'sem_tarefa'): ClienteCard {
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
    ...(contato ? { contato } : {}),
  }
}

interface ClienteTopTeste {
  id: string
  nome_razao_social: string
  cpf_cnpj: string | null
  telefone?: string | null
  email?: string | null
  cidade?: string | null
  estado?: string | null
  status?: string | null
  tipo?: string | null
}

interface TopClienteTeste {
  id: string
  nome: string
  documento: string | null
  pedidos: number
  valor: number
  /** Cliente completo — é ele que o modal de detalhes abre ao clicar na linha */
  cliente?: ClienteTopTeste | null
}

interface Contagens {
  todos: number
  atrasados: number
  realizados: number
}

interface Payload {
  clientes: ClienteCard[]
  total: number
  top?: TopClienteTeste[]
  contatos?: Contagens
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

  it('o ranking vem na MESMA resposta da listagem (sem segunda chamada)', async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch({ clientes: [], total: 1928, top: [] })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()

    // Card e exclusão são o MESMO cálculo: a lista devolve `top` junto, então o
    // card não faz uma chamada própria que poderia divergir do corte (bug de
    // 01/10/2026 — o card vinha de outro request com cache de 5 s e o cliente
    // sumia dos dois lados ao mesmo tempo).
    expect(chamadas(fetchMock, '/api/clientes/top')).toHaveLength(0)

    fireEvent.change(screen.getByPlaceholderText(/Filtrar por/i), { target: { value: 'rio' } })
    await descarregar(400)

    expect(chamadas(fetchMock, '/api/clientes/top')).toHaveLength(0)
    expect(chamadas(fetchMock, '/api/clientes?')).toHaveLength(2)
  })

  it('renderiza o Top 20 que veio junto com a listagem', async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch({
      clientes: [],
      total: 1927,
      top: [
        {
          id: 'edgar-uuid',
          nome: '03.064.950 EDGAR PEREIRA DO NASCIMENTO',
          documento: null,
          pedidos: 1,
          valor: 1000,
        },
      ],
    })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()

    expect(document.body.textContent).toContain('EDGAR PEREIRA DO NASCIMENTO')
    expect(chamadas(fetchMock, '/api/clientes/top')).toHaveLength(0)
  })

  it('clicar numa linha do Top 20 abre os MESMOS detalhes da listagem da direita', async () => {
    vi.useFakeTimers()
    mockFetch({
      clientes: [],
      total: 1928,
      top: [
        {
          id: 'edgar-uuid',
          nome: '03.064.950 EDGAR PEREIRA DO NASCIMENTO',
          documento: '03064950000195',
          pedidos: 1,
          valor: 1000,
          cliente: {
            id: 'edgar-uuid',
            nome_razao_social: '03.064.950 EDGAR PEREIRA DO NASCIMENTO',
            cpf_cnpj: '03064950000195',
            telefone: '556284329503',
            email: 'edgar@example.com',
            cidade: 'Goiania',
            estado: 'GO',
            status: 'bloqueado',
            tipo: 'pf',
          },
        },
      ],
    })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()

    // a linha do ranking vira botão clicável, como as linhas da direita
    const linha = screen.getByRole('button', { name: /03.064.950 EDGAR PEREIRA/ })
    fireEvent.click(linha)
    await descarregar()

    const dialogo = screen.getByRole('dialog')
    expect(dialogo.textContent).toContain('Detalhes do Cliente')
    expect(dialogo.textContent).toContain('03064950000195')
    expect(dialogo.textContent).toContain('556284329503')
  })

  it('item sem cadastro também abre (mostra o nome, sem telefone)', async () => {
    vi.useFakeTimers()
    mockFetch({
      clientes: [],
      total: 1928,
      top: [
        { id: 'sem-cadastro:e-commerce', nome: 'E-commerce', documento: null, pedidos: 2, valor: 1500, cliente: null },
      ],
    })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()

    fireEvent.click(screen.getByRole('button', { name: /E-commerce/ }))
    await descarregar()

    expect(screen.getByRole('dialog').textContent).toContain('E-commerce')
  })

  it('resposta sem `top` (servidor antigo): o card cai para /api/clientes/top', async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch({ clientes: [], total: 1928 })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()

    expect(chamadas(fetchMock, '/api/clientes/top')).toHaveLength(1)
  })
})

describe('PainelInferior — filtros de contato (ATRASADOS vermelho / REALIZADOS verde)', () => {
  it('mostra os três filtros e pede contato=todos na carga inicial', async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch({ clientes: [], total: 1928 })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()

    expect(screen.getByRole('button', { name: /Todos/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Atrasados/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Realizados/ })).toBeTruthy()

    const listagem = chamadas(fetchMock, '/api/clientes?')
    expect(listagem).toHaveLength(1)
    const [url] = listagem[0] as unknown as [string]
    expect(url).toContain('contato=todos')
  })

  it('clicar em Atrasados refaz a busca com contato=atrasados e pinta a linha de vermelho', async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch({
      clientes: [cliente('Bia Atrasada', 'atrasado'), cliente('Zeca Também Atrasado', 'atrasado')],
      total: 3,
      contatos: { todos: 10, atrasados: 3, realizados: 4 },
    })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()

    fireEvent.click(screen.getByRole('button', { name: /Atrasados/ }))
    await descarregar(400)

    const listagem = chamadas(fetchMock, '/api/clientes?')
    expect(listagem).toHaveLength(2)
    const [url] = listagem[1] as unknown as [string]
    expect(url).toContain('contato=atrasados')

    expect(screen.getByText('Bia Atrasada').className).toContain('text-red-600')
    expect(screen.getByText('Zeca Também Atrasado').className).toContain('text-red-600')
    // contagem do grupo aparece no próprio filtro
    expect(screen.getByRole('button', { name: /Atrasados/ }).textContent).toContain('3')
  })

  it('clicar em Realizados pede contato=realizados e pinta a linha de verde', async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch({
      clientes: [cliente('Davi Feito', 'realizado')],
      total: 7,
      contatos: { todos: 10, atrasados: 3, realizados: 7 },
    })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()

    fireEvent.click(screen.getByRole('button', { name: /Realizados/ }))
    await descarregar(400)

    const listagem = chamadas(fetchMock, '/api/clientes?')
    expect(listagem).toHaveLength(2)
    const [url] = listagem[1] as unknown as [string]
    expect(url).toContain('contato=realizados')
    expect(screen.getByText('Davi Feito').className).toContain('text-emerald-600')
  })

  it('sem filtro o cliente sem tarefa fica na cor normal (nem vermelho nem verde)', async () => {
    vi.useFakeTimers()
    mockFetch({ clientes: [cliente('Ana Sem Tarefa', 'sem_tarefa')], total: 1928 })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()

    const linha = screen.getByText('Ana Sem Tarefa')
    expect(linha.className).not.toContain('text-red-600')
    expect(linha.className).not.toContain('text-emerald-600')
  })
})
