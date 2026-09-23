import { describe, it, expect } from 'vitest'
import { termoBuscaClientes, filtroBuscaClientes } from './busca-clientes'

/**
 * Filtro do card CLIENTES (atendimento): o vendedor digita nome, CNPJ, telefone
 * ou e-mail e acha o cliente sem sair da tela. A query vai para o servidor
 * (GET /api/clientes?busca=...) porque a carteira tem milhares de linhas —
 * filtrar os 300 carregados seria mentira.
 */

describe('termoBuscaClientes — limpa o que o PostgREST não aceita', () => {
  it('remove vírgulas e parênteses (quebram a sintaxe do .or())', () => {
    expect(termoBuscaClientes('Roma, (Distribuidora)')).toBe('Roma Distribuidora')
  })

  it('escapa curinga de LIKE para a busca ser literal', () => {
    expect(termoBuscaClientes('100%_pago')).toBe('100\\%\\_pago')
  })

  it('apenas remove espaços das pontas', () => {
    expect(termoBuscaClientes('  Padaria São João  ')).toBe('Padaria São João')
  })

  it('termo vazio/vazio-de-espacos vira string vazia', () => {
    expect(termoBuscaClientes('')).toBe('')
    expect(termoBuscaClientes('   ')).toBe('')
    expect(termoBuscaClientes(null)).toBe('')
    expect(termoBuscaClientes(undefined)).toBe('')
  })
})

describe('filtroBuscaClientes — monta o .or() do PostgREST', () => {
  it('busca em nome, CPF/CNPJ, telefone, celular e e-mail', () => {
    const filtro = filtroBuscaClientes('roma')
    expect(filtro).toBe(
      'nome_razao_social.ilike.%roma%,cpf_cnpj.ilike.%roma%,telefone.ilike.%roma%,celular.ilike.%roma%,email.ilike.%roma%'
    )
  })

  it('termo limpo (sem candidatos) devolve null — não filtra nada', () => {
    expect(filtroBuscaClientes('')).toBeNull()
    expect(filtroBuscaClientes('   ')).toBeNull()
    expect(filtroBuscaClientes(null)).toBeNull()
  })

  it('nunca deixa vírgula crua no filtro', () => {
    const filtro = filtroBuscaClientes('Roma, Ltda')!
    // 5 colunas => exatamente 4 vírgulas separadoras; uma 6ª indicaria termo cru
    expect(filtro.split(',')).toHaveLength(5)
  })
})
