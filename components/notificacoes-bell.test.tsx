// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup, screen } from '@testing-library/react'
import { NotificacoesBell } from './notificacoes-bell'

/**
 * O sininho saiu do header (removido para ganhar altura no Atendimento) e foi
 * para o topo da sidebar, que é escura — por isso ele precisa aceitar className
 * e continuar abrindo o mesmo dropdown de notificações.
 */

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'token-teste' } } }),
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
    }),
  }),
}))

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ notificacoes: [], naoLidas: 0 }) }))
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('NotificacoesBell — sininho preservado fora do header', () => {
  it('aceita className para ficar legível na sidebar escura', () => {
    const { container } = render(<NotificacoesBell className="text-white/60 h-8 w-8" />)
    const botao = container.querySelector('button')!

    expect(botao.className).toContain('text-white/60')
    expect(botao.className).toContain('h-8 w-8')
  })

  it('mantém o ícone herdando a cor do botão (text-current)', () => {
    const { container } = render(<NotificacoesBell className="text-white/60" />)
    const svg = container.querySelector('button svg')!

    expect(svg.getAttribute('class')).toContain('text-current')
  })

  it('abre o dropdown de notificações ao clicar', () => {
    render(<NotificacoesBell />)
    fireEvent.click(screen.getByRole('button'))

    expect(document.body.textContent).toContain('Notificações')
  })
})
