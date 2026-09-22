import { describe, it, expect } from 'vitest'
import { formatarTelefone } from './telefone'

describe('formatarTelefone', () => {
  it('remove caracteres não numéricos de formatos brasileiros', () => {
    expect(formatarTelefone('(62) 3416-5014')).toBe('556234165014')
    expect(formatarTelefone('(62) 99999-0000')).toBe('5562999990000')
  })

  it('adiciona o código do Brasil quando o número vem sem DDI', () => {
    expect(formatarTelefone('6234165014')).toBe('556234165014')
  })

  it('não duplica o 55 quando o DDI já está presente', () => {
    expect(formatarTelefone('556234165014')).toBe('556234165014')
  })

  it('não insere o 9 dígito automaticamente', () => {
    // número fixo antigo (sem 9) deve permanecer como está
    expect(formatarTelefone('6234165014')).toBe('556234165014')
    expect(formatarTelefone('6234165014')).not.toContain('99')
  })
})
