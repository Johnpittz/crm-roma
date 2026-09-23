// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, act, screen } from '@testing-library/react'
import { PainelInferior, type ClienteCard } from './painel-inferior'

/**
 * Card CLIENTES do atendimento: o vendedor filtra a carteira sem sair da tela.
 * A busca vai para o servidor (GET /api/clientes?busca=) com debounce —
 * filtrar só os 300 carregados mentiria para ele.
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

interface Payload {
  clientes: ClienteCard[]
  total: number
}

function mockFetch(payload: Payload) {
  const fn = vi.fn(async () => ({ ok: true, json: async () => ({ ...payload, escopo: 'equipe', limite: 300 }) }))
  vi.stubGlobal('fetch', fn)
  return fn
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
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }]
    expect(url).toContain('/api/clientes?')
    expect(url).toContain('limite=300')
    expect(url).not.toContain('busca=')
    expect(init.headers.Authorization).toBe('Bearer token-teste')
  })

  it('digitar no filtro refaz a busca no servidor com o termo (debounce)', async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch({ clientes: [], total: 0 })

    render(<PainelInferior onAbrirConversa={() => {}} />)
    await descarregar()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByPlaceholderText(/Filtrar por/i), {
      target: { value: 'rio verde' },
    })
    // debounce de 300ms: nada deve disparar antes
    await descarregar(100)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await descarregar(300)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url] = fetchMock.mock.calls[1] as unknown as [string]
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
})
