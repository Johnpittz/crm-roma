// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, act, within } from '@testing-library/react'
import { PainelContato } from './painel-contato'

/**
 * CRIAR TAREFA do painel de contato: o título deixou de ser texto livre
 * e virou dropdown fixo — ENTRAR EM CONTATO / MANDAR ORÇAMENTO / FINANCEIRO.
 * O valor escolhido vira o `titulo` enviado para POST /api/tarefas.
 */

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'token-teste' } } }),
    },
  }),
}))

const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
  const alvo = String(url)
  if (init?.method === 'POST' && alvo.includes('/api/tarefas')) {
    return { ok: true, json: async () => ({ success: true, tarefa: { id: 't1' } }) }
  }
  if (alvo.includes('/api/tarefas')) return { ok: true, json: async () => ({ tarefas: [] }) }
  if (alvo.includes('/api/atendimentos/etiquetas')) return { ok: true, json: async () => ({ etiquetas: [] }) }
  return { ok: true, json: async () => ({}) }
})

function montar() {
  return render(
    <PainelContato
      atendimento={{
        id: 'at1',
        telefone_cliente: '556234165030',
        nome_cliente: 'Cesar Camargo',
        status: 'aberto',
        cliente_id: 'c1',
        clientes: { id: 'c1', nome_razao_social: 'Cesar Camargo' },
      }}
      onFechar={() => {}}
    />
  )
}

async function abrirCriarTarefa() {
  const tituloSecao = screenGetSpanCriarTarefa()
  const secao = tituloSecao.closest('div.border-b') as HTMLElement
  // O cabeçalho tem 2 botões (título + o "+" do meio): clica no do título
  const cabecalho = within(secao)
    .getAllByRole('button')
    .find((b) => b.textContent?.trim() === 'Criar Tarefa')
  fireEvent.click(cabecalho as HTMLElement)
  return secao
}

/** O cabeçalho da seção é um <span>Criar Tarefa</span> (o botão de envio não tem span). */
function screenGetSpanCriarTarefa(): HTMLElement {
  const spans = Array.from(document.querySelectorAll('span')) as HTMLElement[]
  const achado = spans.find((s) => s.textContent?.trim() === 'Criar Tarefa')
  if (!achado) throw new Error('seção "Criar Tarefa" não encontrada')
  return achado
}

/** Último botão da seção = botão de envio. */
function botaoCriar(secao: HTMLElement): HTMLButtonElement {
  const botoes = within(secao).getAllByRole('button')
  return botoes[botoes.length - 1] as HTMLButtonElement
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Criar Tarefa — dropdown fixo de ações', () => {
  it('não tem input de texto livre; oferece só as 3 opções do dropdown', async () => {
    vi.stubGlobal('fetch', fetchMock)
    montar()
    await act(async () => {})

    const secao = await abrirCriarTarefa()

    expect(within(secao).queryByPlaceholderText(/Follow up proposta/i)).toBeNull()
    const opcaoAcao = within(secao).getByRole('option', { name: 'ENTRAR EM CONTATO' })
    const selectAcao = opcaoAcao.closest('select') as HTMLSelectElement
    const opcoes = Array.from(selectAcao.querySelectorAll('option')).map((o) => o.textContent?.trim())
    expect(opcoes).toEqual(['Selecione a ação…', 'ENTRAR EM CONTATO', 'MANDAR ORÇAMENTO', 'FINANCEIRO'])
    expect(within(selectAcao).queryByRole('option', { name: /Baixa|Média|WhatsApp|A Fazer/ })).toBeNull()
  })

  it('envia a opção escolhida como título da tarefa', async () => {
    vi.stubGlobal('fetch', fetchMock)
    montar()
    await act(async () => {})

    const secao = await abrirCriarTarefa()
    const botao = botaoCriar(secao)
    expect(botao.disabled).toBe(true) // ainda sem opção escolhida

    const opcao = within(secao).getByRole('option', { name: 'MANDAR ORÇAMENTO' })
    fireEvent.change(opcao.closest('select') as HTMLSelectElement, {
      target: { value: 'MANDAR ORÇAMENTO' },
    })

    const botaoDepois = botaoCriar(secao)
    expect(botaoDepois.disabled).toBe(false)
    await act(async () => {
      fireEvent.click(botaoDepois)
    })

    const post = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes('/api/tarefas') && init?.method === 'POST'
    ) as unknown as [string, RequestInit] | undefined
    expect(post).toBeTruthy()
    expect(JSON.parse(String(post![1].body)).titulo).toBe('MANDAR ORÇAMENTO')
  })
})
