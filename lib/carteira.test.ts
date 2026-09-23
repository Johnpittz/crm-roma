import { describe, it, expect } from 'vitest'
import {
  escopoCarteira,
  ehGestor,
  aplicarEscopoClientes,
  idsDaEquipe,
  pertenceAoEscopo,
} from './carteira'

/**
 * REGRA (documentada em PROGRESSO.MD e docs/README.md):
 * a carteira é dividida ENTRE OS GESTORES — cada gestor vê a carteira da sua
 * equipe; a direção vê tudo; cada vendedor vê só o que é dele.
 *
 * Produção 23/09/2026: GERENTE 1.928 (Christyan, Dara, Raquel, Valdean, Ellen)
 * + Jackson 1.145 (Brennda + carteira própria dele) = 3.073.
 */

function criarQueryFake() {
  const chamadas: Array<{ metodo: string; args: unknown[] }> = []
  const query: any = {
    select(...args: unknown[]) {
      chamadas.push({ metodo: 'select', args })
      return query
    },
    eq(...args: unknown[]) {
      chamadas.push({ metodo: 'eq', args })
      return query
    },
    in(...args: unknown[]) {
      chamadas.push({ metodo: 'in', args })
      return query
    },
    order(...args: unknown[]) {
      chamadas.push({ metodo: 'order', args })
      return query
    },
  }
  return { query, chamadas }
}

describe('escopoCarteira — quem enxerga o quê', () => {
  it('vendedor vê apenas os próprios clientes', () => {
    expect(escopoCarteira('vendedor')).toBe('proprio')
    expect(escopoCarteira('vendedora')).toBe('proprio')
  })

  it('gerente_comercial vê a carteira da SUA equipe (não a empresa)', () => {
    expect(escopoCarteira('gerente_comercial')).toBe('equipe')
  })

  it('direção (diretor/admin) vê a carteira toda', () => {
    expect(escopoCarteira('diretor')).toBe('todos')
    expect(escopoCarteira('admin')).toBe('todos')
  })

  it('demonstracao NÃO vê clientes reais (mesma regra do sidebar)', () => {
    expect(escopoCarteira('demonstracao')).toBe('proprio')
  })

  it('cargo desconhecido cai no escopo restrito (fail-closed)', () => {
    expect(escopoCarteira('estagiario')).toBe('proprio')
    expect(escopoCarteira('')).toBe('proprio')
    expect(escopoCarteira(null)).toBe('proprio')
    expect(escopoCarteira(undefined)).toBe('proprio')
  })

  it('cargos reais em produção (23/09/2026)', () => {
    expect(escopoCarteira('vendedor')).toBe('proprio') // Brennda, Dara, Raquel...
    expect(escopoCarteira('gerente_comercial')).toBe('equipe') // GERENTE, Jackson
    expect(escopoCarteira('diretor')).toBe('todos') // João Pedro
  })
})

describe('ehGestor — régua única de gerência', () => {
  it('gestores de verdade', () => {
    expect(ehGestor('gerente_comercial')).toBe(true)
    expect(ehGestor('diretor')).toBe(true)
    expect(ehGestor('admin')).toBe(true)
  })

  it('não são gestores', () => {
    expect(ehGestor('vendedor')).toBe(false)
    expect(ehGestor('demonstracao')).toBe(false)
    expect(ehGestor(null)).toBe(false)
    expect(ehGestor(undefined)).toBe(false)
    expect(ehGestor('')).toBe(false)
  })
})

describe('aplicarEscopoClientes — aplica o filtro na query', () => {
  it('escopo "proprio" filtra por vendedor_responsavel_id do usuário', () => {
    const { query, chamadas } = criarQueryFake()
    const retorno = aplicarEscopoClientes(query, 'proprio', 'user-123')

    expect(retorno).toBe(query)
    expect(chamadas).toContainEqual({
      metodo: 'eq',
      args: ['vendedor_responsavel_id', 'user-123'],
    })
  })

  it('escopo "equipe" filtra por in() com a equipe + o próprio gestor', () => {
    const { query, chamadas } = criarQueryFake()
    aplicarEscopoClientes(query, 'equipe', 'gestor-1', ['v1', 'v2', 'gestor-1'])

    const filtro = chamadas.find((c) => c.metodo === 'in')
    expect(filtro?.args).toEqual(['vendedor_responsavel_id', ['gestor-1', 'v1', 'v2']])
    expect(chamadas.some((c) => c.metodo === 'eq')).toBe(false)
  })

  it('escopo "equipe" sem equipe resolvida cai no próprio (fail-closed)', () => {
    const { query, chamadas } = criarQueryFake()
    aplicarEscopoClientes(query, 'equipe', 'gestor-1', [])

    const filtro = chamadas.find((c) => c.metodo === 'in')
    expect(filtro?.args).toEqual(['vendedor_responsavel_id', ['gestor-1']])
  })

  it('escopo "todos" não adiciona filtro algum', () => {
    const { query, chamadas } = criarQueryFake()
    aplicarEscopoClientes(query, 'todos', 'user-123')

    expect(chamadas).toHaveLength(0)
  })
})

describe('idsDaEquipe — resolve quem compõe a carteira do gestor', () => {
  it('busca os vendedores com gestor_id = gestor', async () => {
    const chamadas: unknown[][] = []
    const db: any = {
      from(tabela: string) {
        return {
          select(cols: string) {
            return {
              eq(col: string, valor: string) {
                chamadas.push([tabela, cols, col, valor])
                return Promise.resolve({ data: [{ id: 'v1' }, { id: 'v2' }], error: null })
              },
            }
          },
        }
      },
    }

    const ids = await idsDaEquipe(db, 'gestor-9')

    expect(chamadas).toEqual([['profiles', 'id', 'gestor_id', 'gestor-9']])
    expect(ids).toEqual(['v1', 'v2'])
  })

  it('erro do banco devolve lista vazia (nunca derruba a página)', async () => {
    const db: any = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
        }),
      }),
    }
    expect(await idsDaEquipe(db, 'g')).toEqual([])
  })
})

describe('pertenceAoEscopo — checagem em memória (Campanhas)', () => {
  it('direção vê qualquer cliente', () => {
    expect(pertenceAoEscopo('todos', 'd1', [], 'qualquer')).toBe(true)
    expect(pertenceAoEscopo('todos', 'd1', [], null)).toBe(true)
  })

  it('vendedor vê só o dele', () => {
    expect(pertenceAoEscopo('proprio', 'v1', [], 'v1')).toBe(true)
    expect(pertenceAoEscopo('proprio', 'v1', [], 'v2')).toBe(false)
    expect(pertenceAoEscopo('proprio', 'v1', [], null)).toBe(false)
  })

  it('gestor vê a equipe + a carteira própria', () => {
    expect(pertenceAoEscopo('equipe', 'g1', ['v1', 'v2'], 'v2')).toBe(true)
    expect(pertenceAoEscopo('equipe', 'g1', ['v1', 'v2'], 'g1')).toBe(true)
    expect(pertenceAoEscopo('equipe', 'g1', ['v1', 'v2'], 'v3')).toBe(false)
    expect(pertenceAoEscopo('equipe', 'g1', ['v1'], null)).toBe(false)
  })
})
