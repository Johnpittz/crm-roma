import { describe, it, expect } from 'vitest'
import { escopoCarteira, ehGestor, aplicarEscopoClientes } from './carteira'

/**
 * Builder falso no formato do supabase-js: `eq()` registra a chamada e
 * retorna a própria query (encadeável), como o PostgrestFilterBuilder real.
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
    order(...args: unknown[]) {
      chamadas.push({ metodo: 'order', args })
      return query
    },
  }
  return { query, chamadas }
}

describe('escopoCarteira — quem enxerga a carteira inteira', () => {
  it('vendedor vê apenas os próprios clientes', () => {
    expect(escopoCarteira('vendedor')).toBe('proprio')
  })

  it('vendedora vê apenas os próprios clientes', () => {
    expect(escopoCarteira('vendedora')).toBe('proprio')
  })

  it('gerente_comercial vê a carteira toda (visão provisória)', () => {
    expect(escopoCarteira('gerente_comercial')).toBe('todos')
  })

  it('diretor vê a carteira toda', () => {
    expect(escopoCarteira('diretor')).toBe('todos')
  })

  it('admin vê a carteira toda', () => {
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
    expect(escopoCarteira('gerente_comercial')).toBe('todos') // GERENTE, Jackson
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

  it('escopo "todos" não adiciona filtro algum', () => {
    const { query, chamadas } = criarQueryFake()
    aplicarEscopoClientes(query, 'todos', 'user-123')

    expect(chamadas.filter((c) => c.metodo === 'eq')).toHaveLength(0)
  })

  it('não filtra por outro vendedor sob nenhuma hipótese', () => {
    const { query, chamadas } = criarQueryFake()
    aplicarEscopoClientes(query, 'proprio', 'user-123')

    const filtro = chamadas.find((c) => c.metodo === 'eq')
    expect(filtro?.args).toEqual(['vendedor_responsavel_id', 'user-123'])
  })
})
