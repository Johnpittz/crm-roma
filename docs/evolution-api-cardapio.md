# 🍽️ Evolution API — Cardápio Completo para CRM

> **Referência definitiva** de tudo que a Evolution API (v2) pode fazer via WhatsApp + Baileys, organizado para arquitetos de CRM.
>
> **Autor:** Documento gerado para uso nos projetos **STK-CRM** e **CRM ROMA**  
> **Ambiente:** VPS `2.25.192.248:8080` · Instâncias: `STK-1`, `ROMA_1`  
> **Última atualização:** Setembro 2026

---

## 📡 Informações de Conexão

| Item | Valor |
|------|-------|
| **Base URL** | `http://2.25.192.248:8080` |
| **Porta interna** | 8082 (Nginx proxy → 8080) |
| **Instância STK** | `STK-1` |
| **Instância ROMA** | `ROMA_1` |
| **Headers obrigatórios** | `apikey: YOUR_KEY` · `Content-Type: application/json` |
| **Formato de URL** | `/message/sendText/{instanceName}` |

### Exemplo de Requisição Base

```bash
curl -X POST "http://2.25.192.248:8080/message/sendText/STK-1" \
  -H "apikey: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"number": "5511999999999", "text": "Olá!"}'
```

---

## 1. 📤 O QUE VOCÊ PODE ENVIAR (Outbound Messages)

### 1.1 Texto Simples — `sendText`

**Endpoint:** `POST /message/sendText/{instanceName}`

```json
{
  "number": "5511999999999",
  "text": "Olá! Bem-vindo ao atendimento.",
  "delay": 1200
}
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `number` | string | ✅ | Número no formato `5511999999999` (DDI + DDD + Número) |
| `text` | string | ✅ | Texto da mensagem. Suporta `\n` para quebras de linha |
| `delay` | number | ❌ | Atraso em milissegundos antes de enviar (simula digitação) |
| `quoted` | object | ❌ | Mensagem para citar/responder |

> ⚡ **Dica CRM:** Use `delay` de 1000-3000ms para simular comportamento humano e evitar bloqueio.

---

### 1.2 Áudio / PTT — `sendWhatsAppAudio`

**Endpoint:** `POST /message/sendWhatsAppAudio/{instanceName}`

```json
{
  "number": "5511999999999",
  "audio": "https://exemplo.com/audio.ogg",
  "ptt": true
}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `audio` | string | URL do arquivo de áudio (.ogg) |
| `ptt` | boolean | `true` = push-to-talk (mensagem de voz); `false` = áudio comum |
| `delay` | number | Atraso em ms antes do envio |

> ⚠️ **Formato aceito:** O WhatsApp aceita apenas `.ogg` (Opus). Converta antes de enviar.
> 
> 💡 Para enviar áudio via base64, use o campo `audio` com o data URI: `data:audio/ogg;base64,T2dnUw...`

---

### 1.3 Imagem com Legenda — `sendWhatsAppImage`

**Endpoint:** `POST /message/sendWhatsAppImage/{instanceName}`

```json
{
  "number": "5511999999999",
  "caption": "Confira nossa nova promoção!",
  "image": "https://exemplo.com/promo.jpg",
  "delay": 2000
}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `image` | string | URL da imagem (.jpg, .png, .webp) |
| `caption` | string | Legenda da imagem |
| `delay` | number | Atraso em ms |

> 💡 **Base64 aceito:** `"image": "data:image/jpeg;base64,/9j/4AAQ..."` — mas **NÃO salve no banco** (veja Seção 4).

---

### 1.4 Vídeo com Legenda — `sendWhatsAppVideo`

**Endpoint:** `POST /message/sendWhatsAppVideo/{instanceName}`

```json
{
  "number": "5511999999999",
  "caption": "Veja como funciona nosso produto",
  "video": "https://exemplo.com/demo.mp4",
  "delay": 3000
}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `video` | string | URL do vídeo (.mp4) |
| `caption` | string | Legenda do vídeo |

> ⚠️ **Limite do WhatsApp:** Vídeos de até ~16MB. Para vídeos maiores, envie como documento.

---

### 1.5 Documento / Arquivo — `sendWhatsAppFile`

**Endpoint:** `POST /message/sendWhatsAppFile/{instanceName}`

```json
{
  "number": "5511999999999",
  "fileName": "proposta_comercial.pdf",
  "caption": "Segue a proposta comercial conforme solicitado.",
  "file": "https://exemplo.com/proposta.pdf",
  "delay": 1500
}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `file` | string | URL do arquivo |
| `fileName` | string | Nome do arquivo que aparece no WhatsApp |
| `caption` | string | Descrição/legenda do arquivo |

> 💡 Aceita qualquer formato: PDF, XLSX, DOCX, ZIP, etc. Limite: ~100MB.

---

### 1.6 Localização — `sendLocation`

**Endpoint:** `POST /message/sendLocation/{instanceName}`

```json
{
  "number": "5511999999999",
  "name": "Escritório STK-CRM",
  "address": "Av. Paulista, 1000 - São Paulo, SP",
  "latitude": -23.561414,
  "longitude": -46.655881
}
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `latitude` | number | ✅ | Latitude geográfica |
| `longitude` | number | ✅ | Longitude geográfica |
| `name` | string | ❌ | Nome do local |
| `address` | string | ❌ | Endereço por extenso |

> 💡 **Útil para CRMs de campo:** Enviar localização de técnicos em atendimento.

---

### 1.7 Contato (vCard) — `sendContactVcard`

**Endpoint:** `POST /message/sendContactVcard/{instanceName}`

```json
{
  "number": "5511999999999",
  "contactName": "João Pedro - Suporte",
  "vcard": "BEGIN:VCARD\nVERSION:3.0\nFN:João Pedro\nTEL;TYPE=CELL:+5511999999999\nEMAIL:joao@exemplo.com\nEND:VCARD"
}
```

> 💡 Para enviar múltiplos contatos, use `sendContactVcardMultiple` com array de vCards.

---

### 1.8 Sticker — `sendWhatsAppSticker`

**Endpoint:** `POST /message/sendWhatsAppSticker/{instanceName}`

```json
{
  "number": "5511999999999",
  "sticker": "https://exemplo.com/sticker.webp"
}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sticker` | string | URL da imagem (.webp) ou base64 data URI |

> ⚠️ **Formato:** WebP com fundo transparente, 512x512px recomendado.

---

### 1.9 Reação a Mensagem — `sendReaction`

**Endpoint:** `POST /message/sendReaction/{instanceName}`

```json
{
  "number": "5511999999999",
  "reaction": "👍",
  "key": {
    "id": "3EB0A1B2C3D4E5F6",
    "fromMe": false,
    "remoteJid": "5511999999999@s.whatsapp.net"
  }
}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `key` | object | Chave da mensagem que quer reagir (`id`, `fromMe`, `remoteJid`) |
| `reaction` | string | Emoji (vazio `""` para remover reação) |

> 💡 **Dica:** Pegue o `key.id` da mensagem recebida via webhook e salve no seu banco para poder reagir depois.

---

### 1.10 Enquete / Poll — `sendPollMessage`

**Endpoint:** `POST /message/sendPollMessage/{instanceName}`

```json
{
  "number": "5511999999999",
  "name": "Qual horário você prefere para a reunião?",
  "values": ["09:00", "14:00", "18:00"],
  "selectableCount": 1
}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Pergunta da enquete |
| `values` | string[] | Opções de resposta (mínimo 2, máximo 12) |
| `selectableCount` | number | Quantas opções o usuário pode selecionar (0 = ilimitado) |

> 💡 **CRM:** Ótimo para pesquisas de satisfação e agendamento rápido.

---

### 1.11 Botões Interativos — `sendButtons`

**Endpoint:** `POST /message/sendButtons/{instanceName}`

```json
{
  "number": "5511999999999",
  "title": "Atendimento",
  "description": "Como podemos ajudar?",
  "buttons": [
    { "type": "reply", "reply": { "id": "btn_vendas", "title": "Vendas" } },
    { "type": "reply", "reply": { "id": "btn_suporte", "title": "Suporte" } },
    { "type": "reply", "reply": { "id": "btn_financeiro", "title": "Financeiro" } }
  ]
}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `title` | string | Título da mensagem (até 20 caracteres) |
| `description` | string | Corpo da mensagem |
| `buttons` | array | Array de botões (máximo 3 do tipo `reply`) |

> ⚠️ **Máximo 3 botões.** Tipos disponíveis: `reply` (com `id` e `title`).
> 
> 💡 **Automação:** No webhook, quando o cliente clica no botão, você recebe um `buttonId` no payload. Use isso para criar ramificações automáticas.

---

### 1.12 Lista Interativa — `sendList`

**Endpoint:** `POST /message/sendList/{instanceName}`

```json
{
  "number": "5511999999999",
  "title": "Departamentos",
  "description": "Escolha o departamento desejado",
  "buttonText": "Ver departamentos",
  "footerText": "STK-CRM Atendimento",
  "sections": [
    {
      "title": "Departamentos",
      "rows": [
        { "title": "Comercial", "description": "Vendas e orçamentos", "rowId": "dept_comercial" },
        { "title": "Suporte", "description": "Ajuda técnica", "rowId": "dept_suporte" },
        { "title": "Financeiro", "description": "Boletos e pagamentos", "rowId": "dept_financeiro" }
      ]
    }
  ]
}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `title` | string | Título da lista |
| `description` | string | Descrição |
| `buttonText` | string | Texto do botão que abre a lista |
| `sections` | array | Seções com `rows` (cada row: `title`, `description`, `rowId`) |

> 💡 **Limitações:** Máximo 10 seções, 10 rows por seção, 60 caracteres no `rowId`.

---

### 1.13 Template de Mensagem — `sendTemplate`

**Endpoint:** `POST /message/sendTemplate/{instanceName}`

```json
{
  "number": "5511999999999",
  "template": {
    "name": "order_confirmation",
    "language": { "code": "pt_BR" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "João Pedro" },
          { "type": "text", "text": "PED-2026-001" }
        ]
      },
      {
        "type": "button",
        "sub_type": "url",
        "index": 0,
        "parameters": [
          { "type": "text", "text": "PED-2026-001" }
        ]
      }
    ]
  }
}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `template.name` | string | Nome do template aprovado no WhatsApp Manager |
| `template.language` | object | Código do idioma (`pt_BR`, `en_US`, etc.) |
| `template.components` | array | Componentes: `body`, `header`, `button` |

> ⚠️ **Obrigatório:** O template precisa estar aprovado no WhatsApp Business Manager antes de enviar.
>
> 💡 **Tipos de header:** `text`, `image`, `video`, `document` — cada um aceita `parameters` com o conteúdo.

---

### 1.14 Mídia Genérica — `sendMedia`

**Endpoint:** `POST /message/sendMedia/{instanceName}`

```json
{
  "number": "5511999999999",
  "mediatype": "image",
  "media": "https://exemplo.com/foto.jpg",
  "caption": "Legenda opcional"
}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `mediatype` | string | `image`, `video`, `document`, `audio`, `sticker` |
| `media` | string | URL ou base64 do arquivo |
| `caption` | string | Legenda (não se aplica a sticker/audio) |

> 💡 Endpoint genérico que unifica envio de mídia. Prefira os endpoints específicos (1.3, 1.4, 1.5) quando possível — são mais explícitos.

---

### 1.15 Agendamento de Envio — `scheduleMessage`

**Endpoint:** `POST /message/scheduleMessage/{instanceName}`

```json
{
  "number": "5511999999999",
  "text": "Bom dia! Sua reunião é hoje às 14h.",
  "schedule": {
    "date": "2026-09-22",
    "time": "08:00"
  }
}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `schedule.date` | string | Data no formato `YYYY-MM-DD` |
| `schedule.time` | string | Hora no formato `HH:MM` (horário do servidor) |

> ⚠️ O horário é baseado no timezone do servidor VPS. Verifique se está UTC ou BRT.

---

## 2. 📥 O QUE VOCÊ PODE RECEBER (Inbound via Webhook)

> **Webhook configurado em:** `POST /webhook/set/{instanceName}`  
> **Evento principal:** `messages.upsert`  
> **Todos os dados chegam no campo `data` do payload.**

### Resumo dos Eventos

| # | Tipo | Evento | Campo Principal |
|---|------|--------|-----------------|
| 1 | Texto | `messages.upsert` | `data.message.conversation` ou `data.message.extendedTextMessage` |
| 2 | Áudio | `messages.upsert` | `data.message.audioMessage` |
| 3 | Imagem | `messages.upsert` | `data.message.imageMessage` |
| 4 | Vídeo | `messages.upsert` | `data.message.videoMessage` |
| 5 | Documento | `messages.upsert` | `data.message.documentMessage` |
| 6 | Localização | `messages.upsert` | `data.message.locationMessage` |
| 7 | Contato | `messages.upsert` | `data.message.contactsArrayMessage` |
| 8 | Sticker | `messages.upsert` | `data.message.stickerMessage` |
| 9 | Reação | `messages.upsert` | `data.message.reactionMessage` |
| 10 | Enquete | `messages.upsert` | `data.message.pollUpdateMessage` |
| 11 | Chamada | `calls.upsert` | `data` |
| 12 | Presença | `presence.update` | `data.lastPresence` |
| 13 | Deletada | `messages.update` | `data.update.messageStubType: 68` |
| 14 | Editada | `messages.upsert` | `data.message.editedMessage` |

---

### 2.1 Texto — `conversation` / `extendedTextMessage`

**Payload chega com:**

```json
{
  "event": "messages.upsert",
  "instance": "STK-1",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0A1B2C3D4"
    },
    "pushName": "João Pedro",
    "message": {
      "conversation": "Olá, preciso de ajuda"
    },
    "messageTimestamp": 1695302400,
    "status": "DELIVERY_ACK"
  }
}
```

**Mensagem estendida (com citação):**
```json
{
  "message": {
    "extendedTextMessage": {
      "text": "Entendi, vou verificar",
      "contextInfo": {
        "stanzaId": "3EB0PREVIOUS123",
        "participant": "5511999999999@s.whatsapp.net",
        "quotedMessage": { ... }
      }
    }
  }
}
```

**O que fazer no CRM:**
- Extrair `data.key.remoteJid` como identificador do contato
- Extrair `data.message.conversation` (ou `.text` se for extended)
- Extrair `data.pushName` como nome do contato
- Verificar `data.key.fromMe` — se `true`, é mensagem sua (eco/confirmação)
- Salvar no banco com `key.id` para poder citar/reagir depois

---

### 2.2 Áudio — `audioMessage`

```json
{
  "message": {
    "audioMessage": {
      "mimetype": "audio/ogg; codecs=opus",
      "fileLength": 45230,
      "seconds": 6,
      "ptt": true,
      "mediaUrl": "https://cdn.exemplo.com/media/abc123",
      "mediaKey": "base64..."
    }
  }
}
```

**O que fazer:**
- Receber a URL em `mediaUrl` (ou `url`) — fazer download
- Para transcrição, usar API externa (Whisper, Deepgram, etc.)
- Salvar o áudio como arquivo no Supabase Storage

---

### 2.3 Imagem — `imageMessage`

```json
{
  "message": {
    "imageMessage": {
      "caption": "Olha essa foto",
      "mimetype": "image/jpeg",
      "fileLength": 234567,
      "width": 1920,
      "height": 1080,
      "mediaUrl": "https://cdn.exemplo.com/media/img456"
    }
  }
}
```

**O que fazer:**
- Baixar via `mediaUrl`
- Salvar no Supabase Storage
- Exibir thumbnail no CRM, link para mídia original

---

### 2.4 Vídeo — `videoMessage`

```json
{
  "message": {
    "videoMessage": {
      "caption": "Demonstração do produto",
      "mimetype": "video/mp4",
      "fileLength": 5234567,
      "seconds": 45,
      "width": 1280,
      "height": 720,
      "mediaUrl": "https://cdn.exemplo.com/media/vid789"
    }
  }
}
```

---

### 2.5 Documento — `documentMessage`

```json
{
  "message": {
    "documentMessage": {
      "fileName": "proposta_v2.pdf",
      "mimetype": "application/pdf",
      "fileLength": 345678,
      "pageCount": 12,
      "mediaUrl": "https://cdn.exemplo.com/media/doc012"
    }
  }
}
```

**O que fazer:**
- Baixar e salvar no Supabase Storage com nome original
- Criar link de download no CRM

---

### 2.6 Localização — `locationMessage`

```json
{
  "message": {
    "locationMessage": {
      "degreesLatitude": -23.561414,
      "degreesLongitude": -46.655881,
      "name": "Escritório",
      "address": "Av. Paulista, 1000"
    }
  }
}
```

**O que fazer:** Salvar coordenadas, exibir no mapa (Google Maps embed) no CRM.

---

### 2.7 Contato — `contactsArrayMessage`

```json
{
  "message": {
    "contactsArrayMessage": {
      "displayName": "Contatos enviados",
      "contacts": [
        {
          "displayName": "Maria Silva",
          "vcard": "BEGIN:VCARD\nVERSION:3.0\nFN:Maria Silva\nTEL;TYPE=CELL:+5511988888888\nEND:VCARD"
        }
      ]
    }
  }
}
```

**O que fazer:** Parse do vCard, extrair nome/telefone/email, salvar como contato no CRM.

---

### 2.8 Sticker — `stickerMessage`

```json
{
  "message": {
    "stickerMessage": {
      "mimetype": "image/webp",
      "fileLength": 45678,
      "isAnimated": false,
      "mediaUrl": "https://cdn.exemplo.com/media/stk345"
    }
  }
}
```

---

### 2.9 Reação — `reactionMessage`

```json
{
  "message": {
    "reactionMessage": {
      "key": {
        "id": "3EB0TARGET_MSG",
        "fromMe": false,
        "remoteJid": "5511999999999@s.whatsapp.net"
      },
      "text": "👍"
    }
  }
}
```

**O que fazer:** Atualizar a mensagem original no CRM com a reação. Se `text` estiver vazio, a reação foi removida.

---

### 2.10 Enquete — `pollUpdateMessage`

```json
{
  "message": {
    "pollUpdateMessage": {
      "name": "Qual horário prefere?",
      "pollUpdates": [
        {
          "vote": {
            "selectedOptions": [
              { "optionName": "14:00" }
            ]
          },
          "senderTimestampMs": "1695302500000"
        }
      ]
    }
  }
}
```

**O que fazer:** Contabilizar votos, atualizar estatísticas da enquete no CRM.

---

### 2.11 Chamada — Evento `calls.upsert`

```json
{
  "event": "calls.upsert",
  "instance": "STK-1",
  "data": {
    "id": "CALL_ID_123",
    "from": "5511999999999@s.whatsapp.net",
    "to": "5511888888888@s.whatsapp.net",
    "isFromMe": false,
    "status": "OFFER",
    "isVideo": false,
    "callDuration": "0",
    "timestamp": 1695302600
  }
}
```

> ⚠️ **IMPORTANTE:** A Evolution API (Baileys) **NÃO permite atender chamadas**. Você só recebe a notificação. Não é possível listar chamadas perdidas/baixadas.

---

### 2.12 Presença — Evento `presence.update`

```json
{
  "event": "presence.update",
  "instance": "STK-1",
  "data": {
    "lastPresence": {
      "jid": "5511999999999@s.whatsapp.net",
      "lastPresence": "composing"  // "available", "unavailable", "composing", "recording"
    }
  }
}
```

**Valores possíveis de `lastPresence`:**

| Valor | Significado |
|-------|-------------|
| `available` | Online |
| `unavailable` | Offline |
| `composing` | Digitando |
| `recording` | Gravando áudio |

> 💡 **CRM:** Mostrar "digitando..." em tempo real para o operador.

---

### 2.13 Mensagem Deletada

Evento: `messages.update` com `messageStubType: 68`

```json
{
  "event": "messages.update",
  "data": {
    "key": {
      "id": "3EB0ORIGINAL",
      "fromMe": false,
      "remoteJid": "5511999999999@s.whatsapp.net"
    },
    "update": {
      "messageStubType": 68,
      "messageStubParameters": ["Original message text"]
    }
  }
}
```

**O que fazer:** Marcar mensagem como deletada no CRM (não apagar — mostrar ícone de "apagada").

---

### 2.14 Mensagem Editada

Evento: `messages.upsert` com `editedMessage`

```json
{
  "event": "messages.upsert",
  "data": {
    "key": {
      "id": "3EB0EDITED",
      "fromMe": false,
      "remoteJid": "5511999999999@s.whatsapp.net"
    },
    "message": {
      "editedMessage": {
        "message": {
          "conversation": "Texto editado aqui"
        }
      }
    }
  }
}
```

**O que fazer:** Atualizar o texto da mensagem original no CRM. Manter histórico da edição.

---

## 3. 🔧 INFRAESTRUTURA & GERENCIAMENTO

### 3.1 Instâncias

#### Criar Instância
```bash
POST /instance/create
```
```json
{
  "instanceName": "STK-1",
  "number": "5511999999999",
  "qrcode": true,
  "reject_call": false,
  "always_online": true,
  "groups_ignore": false,
  "webhook": {
    "enabled": true,
    "url": "https://seu-crm.com/api/webhook/whatsapp",
    "by_events": false,
    "base64": false,
    "events": ["messages.upsert", "messages.update", "presence.update"]
  }
}
```

#### Listar Instâncias
```bash
GET /instance/fetchInstances
```

#### Status da Instância
```bash
GET /instance/connectionState/{instanceName}
```
Resposta: `{ "state": "open" }` ou `{ "state": "close" }`

#### Deletar Instância
```bash
DELETE /instance/delete/{instanceName}
```

#### Reiniciar Instância
```bash
PUT /instance/restart/{instanceName}
```

---

### 3.2 Conexão

#### QR Code
```bash
GET /instance/connect/{instanceName}
```
Retorna `base64` do QR code para escanear com o WhatsApp.

#### Pairing Code (sem câmera)
```bash
POST /instance/pairingCode
```
```json
{
  "instanceName": "STK-1",
  "number": "5511999999999"
}
```
Retorna código numérico para pareamento sem QR.

#### Estado da Conexão
```bash
GET /instance/connectionState/{instanceName}
```
- `"state": "open"` → Conectado ✅
- `"state": "close"` → Desconectado ❌

#### Logout
```bash
GET /instance/logout/{instanceName}
```

---

### 3.3 Contatos

#### Listar Contatos
```bash
GET /chat/whatsappNumbers/{instanceName}
```
```json
{
  "numbers": ["5511999999999", "5511888888888"]
}
```

#### Buscar Contatos da Instância
```bash
GET /chat/getChats/{instanceName}
```

#### Verificar Número WhatsApp
```bash
POST /chat/whatsappNumbers/{instanceName}
```
```json
{
  "numbers": ["5511999999999"]
}
```
Retorna `true`/`false` para cada número se está no WhatsApp.

---

### 3.4 Grupos

#### Criar Grupo
```bash
POST /group/create/{instanceName}
```
```json
{
  "subject": "Equipe STK",
  "description": "Grupo de atendimento",
  "participants": [
    "5511999999999",
    "5511888888888"
  ]
}
```

#### Listar Grupos
```bash
GET /group/fetchAllGroups/{instanceName}
```

#### Participantes do Grupo
```bash
GET /group/participants/{instanceName}/{groupId}
```

#### Adicionar Participantes
```bash
POST /group/updateParticipant/{instanceName}
```
```json
{
  "groupId": "120363XXX@g.us",
  "action": "add",
  "participants": ["5511777777777"]
}
```

Ações disponíveis: `add`, `remove`, `promote`, `demote`

#### Enviar Mensagem para Grupo
```bash
POST /message/sendText/{instanceName}
```
```json
{
  "number": "120363XXX@g.us",
  "text": "Mensagem para o grupo!"
}
```

---

### 3.5 Mensagens Antigas (Histórico)

#### Buscar Mensagens
```bash
POST /chat/findMessages/{instanceName}
```
```json
{
  "where": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net"
    }
  },
  "limit": 50,
  "order": "desc"
}
```

> ⚠️ **Limite:** Baileys só mantém mensagens que foram recebidas/enquanto a instância estava conectada. Não busca histórico do servidor WhatsApp.

---

### 3.6 Webhook

#### Configurar Webhook
```bash
POST /webhook/set/{instanceName}
```
```json
{
  "enabled": true,
  "url": "https://seu-crm.com/api/webhook/whatsapp",
  "by_events": false,
  "base64": false,
  "events": [
    "messages.upsert",
    "messages.update",
    "presence.update",
    "call",
    "instance"
  ]
}
```

#### Configurar Webhook por Evento
```bash
POST /webhook/set/{instanceName}
```
```json
{
  "enabled": true,
  "url": "https://seu-crm.com/api/webhook/whatsapp",
  "by_events": true,
  "webhook_by_events": {
    "messages.upsert": "https://seu-crm.com/api/webhook/messages",
    "messages.update": "https://seu-crm.com/api/webhook/updates",
    "presence.update": "https://seu-crm.com/api/webhook/presence"
  }
}
```

#### Eventos Disponíveis

| Evento | Descrição |
|--------|-----------|
| `messages.upsert` | Mensagem recebida (inbound + outbound echo) |
| `messages.update` | Status da mensagem mudou (sent, delivered, read, deleted) |
| `presence.update` | Presença do contato (online, digitando) |
| `call` | Chamada recebida |
| `instance` | Estado da instância mudou |
| `groups.upsert` | Grupo criado/atualizado |
| `groups.update` | Grupo atualizado |
| `group-participants.update` | Participante entrou/saiu do grupo |

> 💡 **`base64: true`** — inclui mídia codificada no webhook (⚠️ NÃO recomendado, veja Seção 4).

---

### 3.7 Mídia

#### Upload de Mídia
```bash
POST /media/uploadMedia/{instanceName}
```
Upload multipart/form-data com o arquivo.

#### Download de Mídia
```bash
POST /media/getMedia/{instanceName}
```
```json
{
  "message": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "id": "3EB0MEDIA123"
    }
  }
}
```
Retorna o arquivo em base64 ou URL do CDN.

#### Decrypt do CDN
Quando `base64: false` no webhook, as mídias vêm com `mediaUrl` (link temporário do CDN WhatsApp). Use a API para decrypt:

```bash
POST /chat/getBase64FromMediaMessage/{instanceName}
```
```json
{
  "message": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "id": "3EB0MEDIA123"
    }
  }
}
```

---

### 3.8 Perfil

#### Alterar Nome
```bash
PUT /chat/updateProfileName/{instanceName}
```
```json
{
  "name": "STK-CRM Atendimento"
}
```

#### Alterar Foto
```bash
PUT /chat/updateProfilePicture/{instanceName}
```
Upload multipart com a nova foto.

#### Alterar Status
```bash
PUT /chat/updateProfileStatus/{instanceName}
```
```json
{
  "status": "Estamos aqui para ajudar! 🚀"
}
```

---

## 4. ⚠️ LIMITAÇÕES CONHECIDAS

### 4.1 Chamadas NÃO Funcionam

> **A Evolution API usa Baileys, que é baseado no WhatsApp Web.** Portanto:
> - ❌ Não é possível atender chamadas de voz/vídeo
> - ❌ Não é possível fazer chamadas
> - ✅ Você recebe a notificação da chamada (evento `calls.upsert`)
> - ✅ Pode flaggar como "chamada perdida" no CRM

### 4.2 Limites de Envio em Grupos

- ⚠️ Mensagens para grupos grandes podem ser throttled pelo WhatsApp
- ⚠️ Evite enviar para mais de 50 participantes por vez
- ⚠️ Rate limits mais agressivos em grupos
- 💡 Para broadcast, prefira envio individual ou WhatsApp Business API oficial

### 4.3 Mídia Base64 — NUNCA Salvar no Banco

```diff
- ❌ RUIM: Salvar o base64 inteiro no Supabase/PostgreSQL
+ ✅ BOM: Upload para Supabase Storage e salvar apenas a URL
```

**Por quê?**
- Base64 de uma imagem pode ter 5-10MB de texto
- Consome storage do banco desnecessariamente
- Lentidão extrema em queries
- **Regra:** Sempre extrair URL do CDN, fazer upload para seu Storage, salvar a URL

### 4.4 `@lid` vs `@s.whatsapp.net`

```json
{
  "remoteJid": "1234567890@lid",     // ❌ LID - usuário privado ou grupo
  "remoteJid": "5511999999999@s.whatsapp.net"  // ✅ Número normal
}
```

> ⚠️ **ATENÇÃO:** Quando o webhook entrega `@lid`, você **NÃO consegue responder** diretamente. Precisa mapear o LID para o número real usando `GET /chat/whatsappNumbers/{instanceName}` ou ignorar mensagens de usuários com privacidade de número ativada.

### 4.5 `pushName` Pode Estar Errado

```json
{
  "pushName": "João Pedro"  // Pode ser qualquer coisa!
}
```

> ⚠️ O `pushName` é o nome que **o próprio usuário** escolheu no WhatsApp. Pode ser:
> - Nome real
> - "😎😎😎"
> - "Não responda"
> - Nome antigo/deletado
> 
> **Regra:** Nunca usar `pushName` como fonte primária de identificação do contato.

### 4.6 `fromMe` NÃO Deve Ser Ignorado

```json
{
  "key": {
    "fromMe": true  // Isso É mensagem sua!
  }
}
```

> ⚠️ O webhook entrega **TODAS** as mensagens, incluindo as que **VOCÊ enviou** (eco). Sempre verifique `fromMe`:
> - `fromMe: false` → Mensagem do cliente (processar)
> - `fromMe: true` → Mensagem sua (confirmar status, NÃO reprocessar como nova conversa)

---

## 5. 📋 PAYLOAD EXEMPLO COMPLETO (Webhook)

### Mensagem de Texto Recebida

```json
{
  "event": "messages.upsert",
  "instance": "STK-1",
  "apikey": "YOUR_KEY",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0F1A2B3C4D5E6F7A8B9C0"
    },
    "pushName": "João Pedro",
    "message": {
      "conversation": "Olá, preciso de ajuda com meu pedido"
    },
    "messageTimestamp": 1695302400,
    "status": "DELIVERY_ACK",
    "instanceName": "STK-1"
  }
}
```

### Mensagem com Mídia (Imagem)

```json
{
  "event": "messages.upsert",
  "instance": "STK-1",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0MEDIA123ABC"
    },
    "pushName": "Maria Silva",
    "message": {
      "imageMessage": {
        "caption": "Olha o comprovante",
        "mimetype": "image/jpeg",
        "fileLength": 234567,
        "height": 1920,
        "width": 1080,
        "mediaKey": "base64MediaKey==",
        "mediaUrl": "https://cdn.evolut.../media/img_abc123",
        "mediaMimeType": "image/jpeg"
      }
    },
    "messageTimestamp": 1695302500,
    "status": "DELIVERY_ACK"
  }
}
```

### Botão Pressionado

```json
{
  "event": "messages.upsert",
  "instance": "STK-1",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0BTN456DEF"
    },
    "pushName": "Carlos Souza",
    "message": {
      "buttonsResponseMessage": {
        "selectedButtonId": "btn_suporte",
        "contextInfo": {
          "stanzaId": "3EB0ORIGINAL789",
          "participant": "5511999999999@s.whatsapp.net"
        }
      }
    },
    "messageTimestamp": 1695302600
  }
}
```

### Lista Interativa (Opção Selecionada)

```json
{
  "event": "messages.upsert",
  "instance": "STK-1",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0LIST789GHI"
    },
    "pushName": "Ana Costa",
    "message": {
      "listResponseMessage": {
        "title": "Comercial",
        "description": "Vendas e orçamentos",
        "singleSelectReply": {
          "selectedRowId": "dept_comercial"
        }
      }
    },
    "messageTimestamp": 1695302700
  }
}
```

### Reação Recebida

```json
{
  "event": "messages.upsert",
  "instance": "STK-1",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0REACT123JKL"
    },
    "message": {
      "reactionMessage": {
        "key": {
          "id": "3EB0YOURMSG456",
          "fromMe": true,
          "remoteJid": "5511999999999@s.whatsapp.net"
        },
        "text": "❤️"
      }
    },
    "messageTimestamp": 1695302800
  }
}
```

### Status de Entrega (Confirmação)

```json
{
  "event": "messages.update",
  "instance": "STK-1",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": true,
      "id": "3EB0SENT789MNO"
    },
    "update": {
      "status": "READ"  // "SENT", "DELIVERED", "READ"
    }
  }
}
```

### Chamada Recebida

```json
{
  "event": "calls.upsert",
  "instance": "STK-1",
  "data": [
    {
      "id": "CALL_ID_987XYZ",
      "from": "5511999999999@s.whatsapp.net",
      "to": "5511888888888@s.whatsapp.net",
      "isFromMe": false,
      "status": "OFFER",
      "isVideo": false,
      "callDuration": "0",
      "participant": "5511999999999@s.whatsapp.net",
      "networkTime": 0,
      "timestamp": 1695302900
    }
  ]
}
```

### Presença (Digitando)

```json
{
  "event": "presence.update",
  "instance": "STK-1",
  "data": {
    "lastPresence": {
      "jid": "5511999999999@s.whatsapp.net",
      "lastPresence": "composing"
    }
  }
}
```

### Mensagem Deletada

```json
{
  "event": "messages.update",
  "instance": "STK-1",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0DELETED456"
    },
    "update": {
      "messageStubType": 68,
      "messageStubParameters": ["Mensagem original apagada"]
    }
  }
}
```

### Mensagem Editada

```json
{
  "event": "messages.upsert",
  "instance": "STK-1",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0EDITED789"
    },
    "message": {
      "editedMessage": {
        "message": {
          "conversation": "Texto editado pelo usuário"
        }
      }
    },
    "messageTimestamp": 1695303000
  }
}
```

---

## 6. 🔄 FLUXO TÍPICO DE UM CRM

### Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FLUXO COMPLETO                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐     │
│  │ CLIENTE  │───▶│EVOLUTION │───▶│  WEBHOOK  │───▶│   CRM    │     │
│  │ (WhatsApp│    │   API    │    │  ENDPOINT │    │  (Next.js│     │
│  │  Mobile) │    │ (VPS)    │    │  (Supabase│    │  + Supa) │     │
│  └──────────┘    └──────────┘    │  Edge Fn) │    └──────────┘     │
│       ▲                          └──────────┘          │           │
│       │                                                │           │
│       │           ┌──────────┐                         │           │
│       └───────────│EVOLUTION │◀────────────────────────┘           │
│                   │   API    │  Resposta via API                   │
│                   │  sendText│                                     │
│                   └──────────┘                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Passo a Passo Detalhado

#### Passo 1: Mensagem Chega → Webhook
```
Cliente envia "Olá" no WhatsApp
       ↓
Evolution API recebe e repassa para webhook
       ↓
POST https://seu-crm.com/api/webhook/whatsapp
Body: { event: "messages.upsert", data: { ... } }
```

#### Passo 2: Extrair Dados
```typescript
// No webhook handler (Next.js Edge Function ou API Route)
const { key, pushName, message } = event.data;

const remoteJid = key.remoteJid;         // "5511999999999@s.whatsapp.net"
const fromMe = key.fromMe;               // false
const messageId = key.id;                // "3EB0F1A2B3C4D5E6"
const text = message.conversation;        // "Olá"
const timestamp = event.data.messageTimestamp;
```

#### Passo 3: Salvar no Banco (Supabase)
```typescript
// Upsert contato (se não existe, cria)
const { data: contact } = await supabase
  .from('contacts')
  .upsert({
    phone: remoteJid.replace('@s.whatsapp.net', ''),
    name: pushName,
    instance: 'STK-1',
    last_message_at: new Date(timestamp * 1000)
  })
  .select()
  .single();

// Salvar mensagem
await supabase.from('messages').insert({
  contact_id: contact.id,
  instance: 'STK-1',
  message_id: messageId,
  direction: 'inbound',
  type: 'text',
  content: text,
  timestamp: new Date(timestamp * 1000),
  status: 'received'
});
```

#### Passo 4: Mostrar no CRM
```
┌─────────────────────────────────────────────┐
│ STK-CRM - Atendimento                        │
├─────────────────────────────────────────────┤
│ Chat: João Pedro (5511999999999)             │
│ Instância: STK-1                             │
├─────────────────────────────────────────────┤
│ 📥 14:30 - João Pedro:                       │
│ "Olá, preciso de ajuda com meu pedido"      │
│                                              │
│ ═══════════════════════════════════════════  │
│                                              │
│ [ 📎 ] [ 📷 ] [ 👤 ] [ Digite sua mensagem ]│
│                                    [Enviar]  │
└─────────────────────────────────────────────┘
```

#### Passo 5: Operador Responde via API
```typescript
await fetch('http://2.25.192.248:8080/message/sendText/STK-1', {
  method: 'POST',
  headers: {
    'apikey': 'YOUR_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    number: '5511999999999',
    text: 'Olá João! Claro, vou verificar seu pedido. Qual o número?',
    delay: 2000
  })
});
```

#### Passo 6: Confirmação via Webhook
```typescript
// Webhook recebe: messages.update com status: "SENT" → "DELIVERED" → "READ"
await supabase
  .from('messages')
  .update({ status: 'read' })
  .eq('message_id', '3EB0OUTGOING789');
```

### Resumo do Fluxo

```
📨 Mensagem chega
   → 🔔 Webhook dispara
      → 📊 Dados extraídos
         → 💾 Salvo no Supabase
            → 👁️ Visível no CRM (Realtime)
               → 💬 Operador responde
                  → 📤 Enviado via Evolution API
                     → ✅ Confirmação volta via webhook
                        → 📊 Status atualizado no banco
```

---

## 7. 🏗️ CHECKLIST DE IMPLEMENTAÇÃO

### Infraestrutura Básica

- [ ] Criar instância no Evolution API (STK-1 / ROMA_1)
- [ ] Configurar webhook apontando para o endpoint do CRM
- [ ] Testar conexão (QR code ou pairing code)
- [ ] Verificar status: `GET /instance/connectionState/{instanceName}`
- [ ] Criar tabela `contacts` no Supabase
- [ ] Criar tabela `messages` no Supabase
- [ ] Configurar RLS (Row Level Security) no Supabase

### Recebimento de Mensagens

- [ ] Criar endpoint de webhook (ex: `/api/webhook/whatsapp`)
- [ ] Verificar `apikey` no header do webhook (segurança)
- [ ] Ignorar mensagens com `fromMe: true` (eco)
- [ ] Processar `messages.upsert` (texto, mídia, botões, etc.)
- [ ] Processar `messages.update` (status: sent, delivered, read)
- [ ] Processar `presence.update` (digitando, online)
- [ ] Extrair `remoteJid` → mapear para contato no banco
- [ ] Salvar `key.id` para referência futura (citar, reagir)

### Envio de Mensagens

- [ ] Criar função `sendText` com `delay` para simular digitação
- [ ] Criar função `sendImage` com upload de mídia
- [ ] Criar função `sendDocument` para arquivos
- [ ] Criar função `sendAudio` para áudio/PTT
- [ ] Criar função `sendLocation` para geolocalização
- [ ] Criar função `sendReaction` para emojis
- [ ] Criar função `sendPollMessage` para enquetes
- [ ] Implementar templates aprovados (se aplicável)
- [ ] Criar fila de envio com retry (ex: BullMQ ou Supabase Edge)

### Gestão de Mídia

- [ ] Criar bucket no Supabase Storage para mídia
- [ ] Nunca salvar base64 no banco de dados
- [ ] Fazer download da mídia via `getMedia` ou CDN
- [ ] Upload para Supabase Storage
- [ ] Salvar apenas a URL da mídia no banco
- [ ] Implementar cache de mídia (evitar re-download)

### Interface do CRM

- [ ] Exibir conversas em tempo real (Supabase Realtime)
- [ ] Mostrar "digitando..." quando `presence.update` = `composing`
- [ ] Exibir status de entrega (✓ = enviado, ✓✓ = lido)
- [ ] Suporte a mídia inline (imagens, vídeos, documentos)
- [ ] Campo de resposta com botões de ação rápida
- [ ] Transferência de atendimento (mudar operador)
- [ ] Notificações sonoras para novas mensagens

### Segurança

- [ ] Validar `apikey` em todas as chamadas à API
- [ ] NUNCA expor a `apikey` no frontend
- [ ] Usar variáveis de ambiente para credenciais
- [ ] Implementar rate limiting no webhook
- [ ] Log de todas as mensagens recebidas/enviadas
- [ ] Alertas para desconexão da instância

### Monitoramento

- [ ] Dashboard de status das instâncias
- [ ] Alerta quando instância desconecta
- [ ] Métricas: mensagens/dia, tempo de resposta, taxa de leitura
- [ ] Log de erros no envio
- [ ] Health check periódico (`GET /instance/connectionState`)

### Integração com Inteligência (Opcional)

- [ ] Classificar mensagens (urgente, normal, baixa prioridade)
- [ ] Extrair intenção do cliente (texto → categorias)
- [ ] Chatbot / IA para respostas automáticas
- [ ] Transcrição automática de áudio (Whisper API)
- [ ] Análise de sentimento em tempo real

---

## 📚 Referências Rápidas

### URLs dos Endpoints Principais

| Ação | Método | URL |
|------|--------|-----|
| Enviar texto | POST | `/message/sendText/{instance}` |
| Enviar imagem | POST | `/message/sendWhatsAppImage/{instance}` |
| Enviar vídeo | POST | `/message/sendWhatsAppVideo/{instance}` |
| Enviar documento | POST | `/message/sendWhatsAppFile/{instance}` |
| Enviar áudio | POST | `/message/sendWhatsAppAudio/{instance}` |
| Enviar localização | POST | `/message/sendLocation/{instance}` |
| Enviar contato | POST | `/message/sendContactVcard/{instance}` |
| Enviar sticker | POST | `/message/sendWhatsAppSticker/{instance}` |
| Enviar reação | POST | `/message/sendReaction/{instance}` |
| Enviar enquete | POST | `/message/sendPollMessage/{instance}` |
| Enviar botões | POST | `/message/sendButtons/{instance}` |
| Enviar lista | POST | `/message/sendList/{instance}` |
| Enviar template | POST | `/message/sendTemplate/{instance}` |
| Enviar mídia genérica | POST | `/message/sendMedia/{instance}` |
| Agendar mensagem | POST | `/message/scheduleMessage/{instance}` |
| Criar instância | POST | `/instance/create` |
| Status instância | GET | `/instance/connectionState/{instance}` |
| QR Code | GET | `/instance/connect/{instance}` |
| Config webhook | POST | `/webhook/set/{instance}` |
| Verificar número | POST | `/chat/whatsappNumbers/{instance}` |
| Criar grupo | POST | `/group/create/{instance}` |
| Upload mídia | POST | `/media/uploadMedia/{instance}` |
| Alterar nome | PUT | `/chat/updateProfileName/{instance}` |
| Alterar foto | PUT | `/chat/updateProfilePicture/{instance}` |
| Alterar status | PUT | `/chat/updateProfileStatus/{instance}` |

---

> **📝 Nota:** Este documento é uma referência viva. Atualize conforme a Evolution API lança novas versões ou quando você descobrir novos detalhes de implementação.
>
> **Última atualização:** Setembro 2026  
> **Autor:** Hermes Agent para João Pedro / STK-CRM & CRM ROMA
