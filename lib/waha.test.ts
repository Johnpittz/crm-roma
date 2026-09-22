import { describe, it, expect } from 'vitest'
import { enviarTexto, enviarMidia, enviarAudio, enviarLido, verificarSessao, checkNumbers, findContacts, resolverLid, buscarNomeContato, type FetchImpl, type Mediatype } from './waha'

function fakeFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const impl: FetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init })
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response
  }
  return { impl, calls }
}

const CONFIG = { baseUrl: 'http://waha.test:3000', apiKey: 'k-test', session: 'ROMA_1' }

describe('enviarTexto', () => {
  it('envia POST /api/sendText com chatId @c.us e devolve o message_id', async () => {
    const { impl, calls } = fakeFetch(200, { id: 'msg-123' })

    const resultado = await enviarTexto(
      { telefone: '(62) 3416-5014', mensagem: 'Olá!' },
      { fetchImpl: impl, config: CONFIG }
    )

    expect(resultado.success).toBe(true)
    expect(resultado.message_id).toBe('msg-123')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('http://waha.test:3000/api/sendText')
    expect(calls[0].init.method).toBe('POST')
    expect(calls[0].init.headers).toMatchObject({ 'X-Api-Key': 'k-test' })
    const body = JSON.parse(String(calls[0].init.body))
    expect(body).toEqual({ chatId: '556234165014@c.us', text: 'Olá!', session: 'ROMA_1' })
  })

  it('retorna success:false com erro quando a API responde 4xx', async () => {
    const { impl } = fakeFetch(422, { error: 'chat not found' })

    const resultado = await enviarTexto(
      { telefone: '5562999990000', mensagem: 'oi' },
      { fetchImpl: impl, config: CONFIG }
    )

    expect(resultado.success).toBe(false)
    expect(resultado.error).toContain('422')
  })

  it('aceita session explícita ignorando a padrão', async () => {
    const { impl, calls } = fakeFetch(200, { id: 'msg-2' })

    await enviarTexto(
      { telefone: '5562999990000', mensagem: 'oi', session: 'ROMA_2' },
      { fetchImpl: impl, config: CONFIG }
    )

    const body = JSON.parse(String(calls[0].init.body))
    expect(body.session).toBe('ROMA_2')
  })
})

describe('enviarMidia', () => {
  it('envia imagem por POST /api/sendImage com o payload file do WAHA', async () => {
    const { impl, calls } = fakeFetch(200, { id: 'mid-1' })

    const resultado = await enviarMidia(
      {
        telefone: '5562999990000',
        mediatype: 'image',
        mimetype: 'image/jpeg',
        media: 'AAAA',
        fileName: 'foto.jpg',
      },
      { fetchImpl: impl, config: CONFIG }
    )

    expect(resultado.success).toBe(true)
    expect(resultado.message_id).toBe('mid-1')
    expect(calls[0].url).toBe('http://waha.test:3000/api/sendImage')
    const body = JSON.parse(String(calls[0].init.body))
    expect(body.chatId).toBe('5562999990000@c.us')
    expect(body.session).toBe('ROMA_1')
    expect(body.file).toEqual({
      mimetype: 'image/jpeg',
      filename: 'foto.jpg',
      data: 'AAAA',
    })
  })

  it('roteia o endpoint pelo mediatype (video, document)', async () => {
    const casos: Array<[Mediatype, string]> = [
      ['video', '/api/sendVideo'],
      ['document', '/api/sendFile'],
      ['audio', '/api/sendFile'],
      ['sticker', '/api/sendSticker'],
    ]
    for (const [mediatype, endpoint] of casos) {
      const { impl, calls } = fakeFetch(200, { id: 'x' })
      await enviarMidia(
        { telefone: '5562999990000', mediatype, mimetype: 'm', media: 'AA' },
        { fetchImpl: impl, config: CONFIG }
      )
      expect(calls[0].url).toBe(`http://waha.test:3000${endpoint}`)
    }
  })
})

describe('enviarAudio', () => {
  it('envia nota de voz por POST /api/sendVoice', async () => {
    const { impl, calls } = fakeFetch(200, { id: 'aud-1' })

    const resultado = await enviarAudio(
      { telefone: '(62) 99999-0000', audio: 'BBBB' },
      { fetchImpl: impl, config: CONFIG }
    )

    expect(resultado.success).toBe(true)
    expect(resultado.message_id).toBe('aud-1')
    expect(calls[0].url).toBe('http://waha.test:3000/api/sendVoice')
    const body = JSON.parse(String(calls[0].init.body))
    expect(body.chatId).toBe('5562999990000@c.us')
    expect(body.file.data).toBe('BBBB')
    expect(body.session).toBe('ROMA_1')
  })

  it('propaga erro da API com status HTTP', async () => {
    const { impl } = fakeFetch(500, { error: 'engine down' })

    const resultado = await enviarAudio(
      { telefone: '5562999990000', audio: 'BBBB' },
      { fetchImpl: impl, config: CONFIG }
    )

    expect(resultado.success).toBe(false)
    expect(resultado.error).toContain('engine down')
    expect(resultado.error).toContain('500')
  })
})

describe('verificarSessao', () => {
  it('retorna connected:true quando o status é WORKING', async () => {
    const { impl, calls } = fakeFetch(200, { name: 'ROMA_1', status: 'WORKING' })

    const resultado = await verificarSessao({ fetchImpl: impl, config: CONFIG })

    expect(resultado).toEqual({ connected: true, state: 'WORKING' })
    expect(calls[0].url).toBe('http://waha.test:3000/api/sessions/ROMA_1')
    expect(calls[0].init.headers).toMatchObject({ 'X-Api-Key': 'k-test' })
  })

  it('retorna connected:false para outros status', async () => {
    const { impl } = fakeFetch(200, { name: 'ROMA_1', status: 'FAILED' })

    const resultado = await verificarSessao({ fetchImpl: impl, config: CONFIG })

    expect(resultado).toEqual({ connected: false, state: 'FAILED' })
  })

  it('retorna state:error em falha de conexão', async () => {
    const impl: FetchImpl = async () => {
      throw new Error('ECONNREFUSED')
    }

    const resultado = await verificarSessao({ fetchImpl: impl, config: CONFIG })

    expect(resultado).toEqual({ connected: false, state: 'error' })
  })
})

describe('checkNumbers', () => {
  it('converte numberExists/chatId para o formato do CRM', async () => {
    const { impl, calls } = fakeFetch(200, {
      numberExists: true,
      chatId: '5562999990000@c.us',
    })

    const resultado = await checkNumbers(
      { numbers: ['(62) 99999-0000'] },
      { fetchImpl: impl, config: CONFIG }
    )

    expect(resultado.success).toBe(true)
    expect(resultado.results).toEqual([
      { number: '5562999990000', exists: true, jid: '5562999990000@c.us' },
    ])
    expect(calls[0].url).toContain('/api/contacts/check-exists')
    expect(calls[0].url).toContain('phone=5562999990000')
  })

  it('faz uma chamada por número', async () => {
    const { impl, calls } = fakeFetch(200, { numberExists: false, chatId: null })

    await checkNumbers(
      { numbers: ['5562999990000', '5562888880000'] },
      { fetchImpl: impl, config: CONFIG }
    )

    expect(calls).toHaveLength(2)
  })
})

describe('findContacts', () => {
  it('mapeia os contatos WAHA para o formato do CRM', async () => {
    const { impl } = fakeFetch(200, [
      {
        id: '5562999990000@c.us',
        name: 'João Silva',
        pushName: 'João',
        profilePicUrl: 'http://pic/joao.jpg',
      },
    ])

    const resultado = await findContacts({}, { fetchImpl: impl, config: CONFIG })

    expect(resultado.success).toBe(true)
    expect(resultado.total).toBe(1)
    expect(resultado.contacts[0]).toMatchObject({
      remoteJid: '5562999990000@c.us',
      pushName: 'João',
      profilePicUrl: 'http://pic/joao.jpg',
      isSaved: true,
      isGroup: false,
      type: 'contact',
    })
  })

  it('filtra por search no pushName/remoteJid (client-side)', async () => {
    const { impl } = fakeFetch(200, [
      { id: '5562999990000@c.us', name: 'João Silva', pushName: 'João' },
      { id: '5562888880000@c.us', name: 'Maria', pushName: 'Maria' },
    ])

    const resultado = await findContacts(
      { search: 'maria' },
      { fetchImpl: impl, config: CONFIG }
    )

    expect(resultado.contacts).toHaveLength(1)
    expect(resultado.contacts[0].pushName).toBe('Maria')
  })

  it('resolve JIDs @lid para o número real (débito §8.2)', async () => {
    const impl: FetchImpl = async (url) => {
      const u = String(url)
      if (u.includes('/lids/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ lid: '3E22AD6A8D21AE12C15F4C576AFABE9E@lid', pn: '5562999990000@c.us' }),
        } as Response
      }
      return {
        ok: true,
        status: 200,
        json: async () => [{ id: '3E22AD6A8D21AE12C15F4C576AFABE9E@lid', name: 'Contato Lid' }],
      } as Response
    }

    const resultado = await findContacts({}, { fetchImpl: impl, config: CONFIG })

    expect(resultado.contacts[0].remoteJid).toBe('5562999990000@s.whatsapp.net')
  })
})

describe('resolverLid', () => {
  it('consulta /api/sessions/{s}/lids/{lid} e devolve o telefone', async () => {
    const { impl, calls } = fakeFetch(200, {
      lid: '3E22AD6A8D21AE12C15F4C576AFABE9E@lid',
      pn: '5562999990000@c.us',
    })

    const telefone = await resolverLid(
      '3E22AD6A8D21AE12C15F4C576AFABE9E@lid',
      { fetchImpl: impl, config: CONFIG }
    )

    expect(telefone).toBe('5562999990000')
    expect(calls[0].url).toBe(
      'http://waha.test:3000/api/ROMA_1/lids/3E22AD6A8D21AE12C15F4C576AFABE9E'
    )
    expect(calls[0].init.headers).toMatchObject({ 'X-Api-Key': 'k-test' })
  })

  it('devolve null quando o WAHA não conhece o mapeamento (pn: null)', async () => {
    const { impl } = fakeFetch(200, { lid: '3E22@lid', pn: null })

    const telefone = await resolverLid('3E22@lid', { fetchImpl: impl, config: CONFIG })

    expect(telefone).toBeNull()
  })
})

describe('buscarNomeContato', () => {
  it('prefere pushname (nome do WhatsApp) e monta o endpoint /api/{session}/contacts/{id}', async () => {
    const { impl, calls } = fakeFetch(200, {
      id: '556284329526@c.us',
      name: 'Correios Coimbra Coleta',
      pushname: 'AGF Campininha',
    })

    const nome = await buscarNomeContato('556284329526', { fetchImpl: impl, config: CONFIG })

    expect(nome).toBe('AGF Campininha')
    expect(calls[0].url).toBe('http://waha.test:3000/api/ROMA_1/contacts/556284329526@c.us')
    expect(calls[0].init.headers).toMatchObject({ 'X-Api-Key': 'k-test' })
  })

  it('cai para o nome salvo quando não há pushname', async () => {
    const { impl } = fakeFetch(200, { id: 'x', name: 'Correios', pushname: '' })

    const nome = await buscarNomeContato('556284329526', { fetchImpl: impl, config: CONFIG })

    expect(nome).toBe('Correios')
  })

  it('devolve null quando o contato não existe', async () => {
    const { impl } = fakeFetch(404, {})

    const nome = await buscarNomeContato('556284329526', { fetchImpl: impl, config: CONFIG })

    expect(nome).toBeNull()
  })
})

describe('enviarLido', () => {
  it('faz POST /api/sendSeen com session + chatId', async () => {
    const { impl, calls } = fakeFetch(200, { success: true })

    const resultado = await enviarLido('5562999990000', { fetchImpl: impl, config: CONFIG })

    expect(resultado.success).toBe(true)
    expect(calls[0].url).toBe('http://waha.test:3000/api/sendSeen')
    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      session: 'ROMA_1',
      chatId: '5562999990000@c.us',
    })
  })

  it('retorna success:false em erro HTTP', async () => {
    const { impl } = fakeFetch(500, { message: 'sessão fora' })

    const resultado = await enviarLido('5562999990000', { fetchImpl: impl, config: CONFIG })

    expect(resultado.success).toBe(false)
    expect(resultado.error).toContain('500')
  })
})
