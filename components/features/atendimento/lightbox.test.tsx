// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { Lightbox } from './lightbox'

afterEach(cleanup)

describe('Lightbox (imagem expande dentro do CRM)', () => {
  it('não renderiza nada quando fechado (url nula)', () => {
    const { container } = render(<Lightbox url={null} onClose={() => {}} />)
    expect(container.querySelector('img')).toBeNull()
  })

  it('exibe a imagem ampliada com o src informado', () => {
    const { getByAltText } = render(<Lightbox url="https://exemplo.com/foto.jpg" onClose={() => {}} />)
    const img = getByAltText('Imagem ampliada') as HTMLImageElement
    expect(img.src).toBe('https://exemplo.com/foto.jpg')
  })

  it('fecha ao clicar no fundo (backdrop)', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(<Lightbox url="https://exemplo.com/foto.jpg" onClose={onClose} />)
    fireEvent.click(getByTestId('lightbox-overlay'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fecha ao pressionar Esc', () => {
    const onClose = vi.fn()
    render(<Lightbox url="https://exemplo.com/foto.jpg" onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clique na imagem não fecha (não propaga para o backdrop)', () => {
    const onClose = vi.fn()
    const { getByAltText } = render(<Lightbox url="https://exemplo.com/foto.jpg" onClose={onClose} />)
    fireEvent.click(getByAltText('Imagem ampliada'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
