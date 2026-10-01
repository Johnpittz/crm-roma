// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { PreviewTarefa, type TarefaKanban } from './preview-tarefa'

/**
 * Prévia do card no KANBAN: o card tem muito espaço vazio, então a prévia
 * leva tudo que a tarefa já sabe — data, hora, telefone do cliente,
 * descrição, valor da venda e resultado — sem nunca renderizar linha vazia.
 */

function tarefa(extra: Partial<TarefaKanban> = {}): TarefaKanban {
  return {
    id: 't1',
    titulo: 'MANDAR ORÇAMENTO',
    descricao: null,
    tipo: 'whatsapp',
    prioridade: 'media',
    status: 'pendente',
    data_inicio: null,
    hora_inicio: null,
    data_fim: null,
    hora_fim: null,
    resultado: null,
    observacao_resultado: null,
    valor_venda: null,
    cliente_nome: 'E-commerce',
    coluna_kanban: 'a_fazer',
    ordem: 1,
    origem_lead: 'whatsapp',
    created_at: '2026-09-30T19:31:19.728639+00:00',
    clientes: null,
    ...extra,
  }
}

afterEach(cleanup)

describe('PreviewTarefa — prévia do card no kanban', () => {
  it('mantém o essencial: prioridade, título com ícone, origem e cliente', () => {
    const { container } = render(<PreviewTarefa tarefa={tarefa()} />)
    const texto = container.textContent || ''

    expect(texto).toContain('media')
    expect(texto).toContain('MANDAR ORÇAMENTO')
    expect(texto).toContain('WhatsApp')
    expect(texto).toContain('E-commerce')
  })

  it('mostra data, hora, telefone, valor da venda e resultado quando existem', () => {
    const { container } = render(
      <PreviewTarefa
        tarefa={tarefa({
          data_inicio: '2026-10-05',
          hora_inicio: '14:30:00',
          valor_venda: 1000,
          resultado: 'sucesso',
          observacao_resultado: 'Fechou na hora',
          descricao: 'Enviar 10 DVRs de 32 canais',
          clientes: {
            id: 'c1',
            nome_razao_social: 'E-commerce',
            telefone: '556284329503',
          },
        })}
      />
    )
    const texto = container.textContent || ''

    expect(texto).toContain('05/10/2026')
    expect(texto).toContain('14:30')
    expect(texto).toContain('(62) 8432-9503')
    expect(texto).toContain('R$ 1.000,00')
    expect(texto).toContain('Sucesso')
    expect(texto).toContain('Fechou na hora')
    expect(texto).toContain('Enviar 10 DVRs de 32 canais')
  })

  it('descrição fica limitada a 2 linhas (não estoura o card)', () => {
    const { getByText } = render(
      <PreviewTarefa tarefa={tarefa({ descricao: 'texto longo '.repeat(30) })} />
    )

    expect(getByText(/texto longo/).className).toContain('line-clamp-2')
  })

  it('sem os campos, não desenha linha vazia nem zero vazio', () => {
    const { container } = render(<PreviewTarefa tarefa={tarefa({ clientes: null, cliente_nome: null })} />)
    const texto = container.textContent || ''

    expect(texto).not.toContain('R$')
    expect(texto).not.toContain('Sucesso')
    expect(texto).not.toContain('(62)')
    expect(texto).not.toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(texto).toContain('—') // placeholder do cliente continua existindo
  })

  it('telefone cru do WhatsApp sai formatado no padrão brasileiro', () => {
    const { container } = render(
      <PreviewTarefa tarefa={tarefa({ clientes: { id: 'c1', nome_razao_social: 'X', celular: '5562998877665' } })} />
    )
    expect(container.textContent).toContain('(62) 99887-7665')
  })

  it('telefone que não bate com o padrão brasileiro fica como está (sem inventar)', () => {
    const { container } = render(
      <PreviewTarefa tarefa={tarefa({ clientes: { id: 'c1', nome_razao_social: 'X', telefone: '(055) 623945-4420' } })} />
    )
    expect(container.textContent).toContain('(055) 623945-4420')
  })

  it('botão de excluir entrega o id de volta (o kanban apaga)', () => {
    const onExcluir = vi.fn()
    const { container } = render(<PreviewTarefa tarefa={tarefa()} onExcluir={onExcluir} />)

    const botoes = container.querySelectorAll('button')
    fireEvent.click(botoes[0])

    expect(onExcluir).toHaveBeenCalledWith('t1')
  })
})
