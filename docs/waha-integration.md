# Integração WhatsApp — WAHA

## Visão Geral
O CRM ROMA agora suporta **dois providers** de WhatsApp:
1. **WAHA** (padrão) — WhatsApp HTTP API, mais estável e completo
2. **Evolution API** (fallback) — para compatibilidade com configurações existentes

## Arquivos Principais
- `lib/waha-api.ts` — Helpers para WAHA (envio de texto, mídia, áudio)
- `lib/evolution-api.ts` — Helpers para Evolution API (mantido como fallback)
- `app/api/webhooks/waha/route.ts` — Webhook para receber mensagens via WAHA
- `app/api/webhooks/evolution/route.ts` — Webhook original (mantido)
- `app/api/send/media/route.ts` — Rota de envio (suporta ambos providers)
- `scripts/setup-waha.sh` — Script de instalação do WAHA na VPS

## Variáveis de Ambiente

### WAHA (Novo)
```env
WAHA_URL=http://localhost:3001        # URL do WAHA
WAHA_SESSION=ROMA_1                   # Nome da session
```

### Evolution API (Fallback)
```env
EVOLUTION_API_URL=http://localhost:8082
EVOLUTION_API_KEY=sua-api-key
EVOLUTION_INSTANCE=ROMA_1
```

## Setup do WAHA

### 1. Instalar na VPS
```bash
# Copiar o script para a VPS
scp scripts/setup-waha.sh root@2.25.192.248:/tmp/

# Rodar na VPS
ssh root@2.25.192.248
bash /tmp/setup-waha.sh
```

### 2. Conectar Número
1. Acesse o Dashboard: `http://2.25.192.248:3001/dashboard`
2. Clique em "New Session"
3. Digite o nome: `ROMA_1`
4. Escaneie o QR code com seu WhatsApp

### 3. Configurar Webhook
```bash
# Configurar webhook para receber mensagens
curl -X PUT http://localhost:3001/api/sessions/ROMA_1 \
  -H 'Content-Type: application/json' \
  -d '{
    "config": {
      "webhooks": [{
        "url": "https://crm-roma-ten.vercel.app/api/webhooks/waha",
        "events": ["message"]
      }]
    }
  }'
```

### 4. Atualizar Variáveis no Vercel
No painel do Vercel, adicione:
- `WAHA_URL` = `http://2.25.192.248:3001`
- `WAHA_SESSION` = `ROMA_1`

## APIs Utilizadas

### WAHA
| Endpoint | Método | Uso |
|----------|--------|-----|
| `/api/sendText` | POST | Enviar mensagem de texto |
| `/api/sendImage` | POST | Enviar imagem |
| `/api/sendFile` | POST | Enviar documento |
| `/api/sendVideo` | POST | Enviar vídeo |
| `/api/sendVoice` | POST | Enviar áudio/ptt |
| `/api/sessions` | GET | Listar sessões |
| `/api/sessions/{session}` | GET | Status da sessão |
| `/api/{session}/auth/qr` | GET | Obter QR code |

### Webhook (Recebimento)
- Evento: `message`
- Payload: `{ event, session, payload: { chatId, from, body, type, ... } }`

## Fluxo de Envio
1. **Texto**: Usuário digita → Enter → POST `/api/atendimentos/mensagens` → WAHA `sendText`
2. **Arquivo**: Botão Paperclip → Input file → FileReader base64 → POST `/api/send/media` → WAHA `sendImage/sendFile` → POST `/api/atendimentos/mensagens`
3. **Áudio**: Botão Mic → MediaRecorder API → onStop → POST `/api/send/media` → WAHA `sendVoice` → POST `/api/atendimentos/mensagens`

## Fluxo de Recebimento
- **Webhook WAHA**: Mensagens chegam via webhook e são salvas no banco automaticamente
- **Polling 15s**: `fetchMensagens(true)` busca novas mensagens sem loading visual
- **Fallback**: Se não há mensagens na tabela, usa `ultima_mensagem` do atendimento

## Diferenças: WAHA vs Evolution API

| Aspecto | WAHA | Evolution API |
|---------|------|---------------|
| Auth | Session no body | `apikey` header |
| Enviar texto | `POST /api/sendText` | `POST /message/sendText/{instance}` |
| Enviar mídia | Endpoints separados por tipo | `POST /message/sendMedia/{instance}` |
| Receber | `event: message` | `event: messages.upsert` |
| Engine | GOWS/NOWEB/WEBJS | Baileys |
| Dashboard | Completo | Básico |

## Engines do WAHA

| Engine | Browser? | RAM | Recomendação |
|--------|----------|-----|--------------|
| **GOWS** | ❌ Não | ~30MB | 🭐 Recomendado |
| **NOWEB** | ❌ Não | ~50MB | Boa alternativa |
| **WEBJS** | ✅ Sim | ~300MB | Mais estável |

## Troubleshooting

### WAHA não inicia
```bash
docker logs waha
```

### Webhook não recebe mensagens
1. Verifique se o webhook está configurado:
   ```bash
   curl http://localhost:3001/api/sessions/ROMA_1
   ```
2. Verifique os logs do WAHA:
   ```bash
   docker logs waha -f
   ```
3. Verifique se a URL do webhook está acessível

### Mensagens não enviam
1. Verifique se a sessão está `WORKING`:
   ```bash
   curl http://localhost:3001/api/sessions/ROMA_1
   ```
2. Verifique os logs do WAHA para erros

## Changelog

### v1 — 21/09/2026
- Implementação inicial do WAHA
- Criado `lib/waha-api.ts` com helpers completos
- Criado webhook `app/api/webhooks/waha/route.ts`
- Atualizado `app/api/send/media/route.ts` para suportar ambos providers
- Script de setup `scripts/setup-waha.sh`

## Notas para Próximas Tasks
- [ ] Atualizar `chat-inline.tsx` para usar provider correto ao enviar
- [ ] Adicionar seletor de provider na UI (toggle WAHA/Evolution)
- [ ] Monitorar estabilidade do WAHA em produção
- [ ] Considerar remover Evolution API se WAHA funcionar bem
