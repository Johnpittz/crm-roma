import { describe, it, expect } from 'vitest'
import { formatarTelefone, extrairTelefoneJid } from './telefone'

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

describe('extrairTelefoneJid', () => {
  it('remove os sufixos JID (GOWS devolve @c.us, Baileys devolve @s.whatsapp.net)', () => {
    expect(extrairTelefoneJid('556293375645@c.us')).toBe('556293375645')
    expect(extrairTelefoneJid('5511999887766@s.whatsapp.net')).toBe('5511999887766')
    expect(extrairTelefoneJid('556234165014')).toBe('556234165014')
  })

  it('devolve null para @lid não resolvido, grupos e entradas inválidas', () => {
    expect(extrairTelefoneJid('3E22AD6A8D21AE12C15F4C576AFABE9E@lid')).toBeNull()
    expect(extrairTelefoneJid('17502058848385@lid')).toBeNull() // numérico mas não discável
    expect(extrairTelefoneJid('120363042756789@g.us')).toBeNull()
    expect(extrairTelefoneJid('abc')).toBeNull()
    expect(extrairTelefoneJid('')).toBeNull()
    expect(extrairTelefoneJid(null)).toBeNull()
    expect(extrairTelefoneJid(undefined)).toBeNull()
  })
})
