import { describe, it, expect } from 'vitest'
import fixtures from './__fixtures__/waha-webhook.json'
import { parseEventoWaha, mapearTipoMidiaDb, mapearCheckmark, montarConteudo, type MensagemWaha, type AckWaha, type StatusWaha } from './waha-webhook'

describe('parseEventoWaha', () => {
  it('extrai os campos de uma mensagem de texto', () => {
    const resultado = parseEventoWaha(fixtures.message_text) as MensagemWaha

    expect(resultado.evento).toBe('message')
    expect(resultado.telefone).toBe('5562999990000')
    expect(resultado.conteudo).toBe('Olá, tudo bem?')
    expect(resultado.tipo_midia).toBeNull()
    expect(resultado.url_midia).toBeNull()
    expect(resultado.whatsapp_message_id).toBe(
      'false_5562999990000@c.us_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    )
    expect(resultado.from_me).toBe(false)
    expect(resultado.grupo).toBe(false)
  })

  it('extrai mídia com tipo, url e file_name', () => {
    const resultado = parseEventoWaha(fixtures.message_media) as MensagemWaha

    expect(resultado.tipo_midia).toBe('image')
    expect(resultado.url_midia).toBe(
      'http://localhost:3000/api/files/false_5562999990000@c.us_BBBB.jpg'
    )
    expect(resultado.conteudo).toBe('Check this out (caption for the media)!')
    expect(resultado.midia_erro).toBeNull()
  })

  it('marca mídia não baixada (url null) com o erro', () => {
    const resultado = parseEventoWaha(fixtures.message_media_not_downloaded) as MensagemWaha

    expect(resultado.tipo_midia).toBe('audio')
    expect(resultado.url_midia).toBeNull()
    expect(resultado.file_name).toBe('audio-0000.opus')
    expect(resultado.midia_erro).toBe('download error')
  })

  it('reconhece evento message.ack', () => {
    const resultado = parseEventoWaha(fixtures.message_ack_read) as AckWaha

    expect(resultado.evento).toBe('message.ack')
    expect(resultado.whatsapp_message_id).toBe(
      'true_11111111111@c.us_4CC5EDD64BC22EBA6D639F2AF571346C'
    )
    expect(resultado.ack).toBe('read')
  })

  it('reconhece evento session.status', () => {
    const resultado = parseEventoWaha(fixtures.session_status_working) as StatusWaha

    expect(resultado.evento).toBe('session.status')
    expect(resultado.session).toBe('ROMA_1')
    expect(resultado.status).toBe('WORKING')
  })

  it('detecta grupo pelo sufixo @g.us', () => {
    const payloadGrupo = {
      ...fixtures.message_text,
      payload: { ...fixtures.message_text.payload, from: '5562999990000@g.us' },
    }

    const resultado = parseEventoWaha(payloadGrupo) as MensagemWaha

    expect(resultado.grupo).toBe(true)
    expect(resultado.telefone).toBe('5562999990000')
  })

  it('retorna ignorado para evento desconhecido', () => {
    expect(parseEventoWaha({ event: 'presence.update', payload: {} })).toEqual({
      evento: 'ignorado',
    })
    expect(parseEventoWaha(null)).toEqual({ evento: 'ignorado' })
  })
})

describe('parseEventoWaha (payloads GOWS)', () => {
  it('aceita pushname em minúsculas (payload GOWS)', () => {
    const payload: any = { ...fixtures.message_text.payload }
    delete payload.pushName
    const resultado = parseEventoWaha({
      event: 'message',
      payload: { ...payload, pushname: 'Maria G.' },
    }) as MensagemWaha
    expect(resultado.nome).toBe('Maria G.')
  })

  it('marca mensagens vindas de JID @lid (número real é resolvido depois)', () => {
    const resultado = parseEventoWaha({
      event: 'message',
      payload: { ...fixtures.message_text.payload, from: '17502058848385@lid' },
    }) as MensagemWaha
    expect(resultado.de_lid).toBe(true)
    expect(resultado.jid).toBe('17502058848385@lid')
    expect(resultado.telefone).toBe('17502058848385')
  })

  it('não marca @c.us como lid', () => {
    const resultado = parseEventoWaha(fixtures.message_text) as MensagemWaha
    expect(resultado.de_lid).toBe(false)
  })
})

describe('mapearCheckmark', () => {
  it('mapeia ack_status do WAHA para o checkmark visual', () => {
    expect(mapearCheckmark(null)).toBe('enviando')
    expect(mapearCheckmark('pending')).toBe('enviando')
    expect(mapearCheckmark('error')).toBe('erro')
    expect(mapearCheckmark('server')).toBe('entregue')
    expect(mapearCheckmark('device')).toBe('entregue')
    expect(mapearCheckmark('read')).toBe('lido')
    expect(mapearCheckmark('played')).toBe('lido')
  })
})

describe('mapearTipoMidiaDb', () => {
  it('mapeia para os valores do CHECK constraint do banco', () => {
    expect(mapearTipoMidiaDb('image')).toBe('imagem')
    expect(mapearTipoMidiaDb('audio')).toBe('audio')
    expect(mapearTipoMidiaDb('video')).toBe('video')
    expect(mapearTipoMidiaDb('document')).toBe('documento')
    expect(mapearTipoMidiaDb(null)).toBeNull()
  })
})

describe('montarConteudo', () => {
  it('usa [tipo] para mensagens com mídia', () => {
    const msg = parseEventoWaha(fixtures.message_media) as MensagemWaha
    expect(montarConteudo(msg)).toBe('[image]')
  })

  it('usa o texto para mensagens sem mídia', () => {
    const msg = parseEventoWaha(fixtures.message_text) as MensagemWaha
    expect(montarConteudo(msg)).toBe('Olá, tudo bem?')
  })
})
