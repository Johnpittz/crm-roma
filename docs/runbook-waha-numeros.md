# Runbook — Conectar novo número WhatsApp (WAHA)

> **Para humanos e IAs:** este documento descreve o processo completo para conectar
> um novo número de WhatsApp ao WAHA do CRM ROMA. Cada número = uma **sessão** WAHA.
> Status do projeto: `docs/plano-implementacao-waha.md` (Fases 0–2 concluídas).

## 1. Onde o WAHA está

| Item | Valor |
|---|---|
| Servidor | VPS Hostinger `srv1745477.hstgr.cloud` (2.25.192.248) |
| Container | `waha` (Docker do host — NÃO é o container `john_hermes` do code-server) |
| Engine | `GOWS` (WebSocket Go, sem navegador) |
| API pública | `http://srv1745477.hstgr.cloud:3000` (usada pelo Vercel e pelo dashboard) |
| API interna | `http://172.16.1.1:3000` (**usar esta de dentro do container do code-server!**) |
| Dashboard | `http://srv1745477.hstgr.cloud:3000/dashboard` (user `admin`) |
| Credenciais | `.env` em `~/waha/` no host + `/root/crm-roma/.env.local` (`WAHA_API_KEY`) |
| Volume (sessões) | `~/waha/sessions` no host → `/app/.sessions` no container |

### ⚠️ Segredos do ambiente (leia antes de automatizar)

1. **Hairpin NAT:** de dentro do container do code-server, a URL pública:3000 **não conecta**
   (timeout). Use sempre `http://172.16.1.1:3000` por aí. De fora (navegador/Vercel) a URL
   pública funciona normalmente.
2. **A API key** está em `WAHA_API_KEY` no `/root/crm-roma/.env.local` — leia de lá,
   **nunca** imprima em logs/chat.
3. Autenticação: header `X-Api-Key: <WAHA_API_KEY>` em toda chamada (sem chave → 401).
4. **hPanel → Gerenciador Docker** lista apenas projetos Compose; o container `waha`
   (criado via `docker run`) só aparece no `docker ps` do Web console. Cosmético — pode ignorar.
5. O **dashboard** guarda a API key na configuração dele (Workers → lápis → API key).
   Se mostrar "not connected"/toast vermelho, a chave dele está errada — não é o servidor.

## 2. Processo para conectar um novo número (passo a passo)

Substitua `ROMA_N` pelo nome da sessão (convenção: `ROMA_1`, `ROMA_2`, … um nome por número).

```bash
# 0) helpers (rodar sempre que for operar)
GW=http://172.16.1.1:3000                       # de dentro do container do code-server
# GW=http://srv1745477.hstgr.cloud:3000         # de fora (VPS host, outro servidor)
K=$(grep '^WAHA_API_KEY=' /root/crm-roma/.env.local | cut -d= -f2)

# 1) Criar a sessão
curl -s -X POST $GW/api/sessions \
  -H "X-Api-Key: $K" -H "Content-Type: application/json" \
  -d '{"name":"ROMA_N"}'

# 2) Iniciar (STOPPED -> STARTING -> SCAN_QR_CODE)
curl -s -X POST $GW/api/sessions/ROMA_N/start -H "X-Api-Key: $K"
sleep 5

# 3) Conferir status (esperado: SCAN_QR_CODE)
curl -s -H "X-Api-Key: $K" $GW/api/sessions/ROMA_N

# 4) Gerar o QR — ATENÇÃO: o endpoint retorna um PNG cru (não JSON!)
curl -s -H "X-Api-Key: $K" $GW/api/ROMA_N/auth/qr -o qr.png
# -> enviar qr.png como IMAGEM para o usuário escanear
# -> QR vale ~20 segundos; se vencer, repetir o passo 4

# 5) Depois que o usuário escanear, confirmar:
curl -s -H "X-Api-Key: $K" $GW/api/sessions/ROMA_N   # esperado: "status":"WORKING"
```

**Como o usuário escaneia:** WhatsApp do celular → ⋮ → **Aparelhos conectados** →
**Conectar aparelho** → escanear a imagem.

## 3. Comportamentos e armadilhas

| Situação | O que fazer |
|---|---|
| QR vence antes do scan | A sessão vira `FAILED`. Reiniciar: `POST /api/sessions/ROMA_N/stop`, sleep 3, `POST /api/sessions/ROMA_N/start`, sleep 6, puxar QR de novo. |
| `GET .../auth/qr` devolve JSON `{"error":"Session status is not as expected...","status":"FAILED"}` | Sessão caiu — reiniciar como acima e puxar o QR de novo. **PNG válido começa com `89 50 4e 47`**; se não começar assim, é erro. |
| Aparecer "Click to reload QR" no dashboard | Stop + Start na sessão. |
| Sessão `WORKING` depois do scan | Não mexer mais — ela se mantém sozinha; `session.status` reporta desconexões. |
| Vários números | Só repetir o processo com `ROMA_2`, `ROMA_3`… (WAHA Core é ilimitado desde 2026.6.1). |
| Escanear pelo dashboard | Também funciona (Sessions → linha da sessão → ícone de câmera), mas o QR por chat/curl renova sob demanda. |

## 4. Registro no CRM (Fase 4 em diante)

- O nome da sessão vira o valor de `WAHA_SESSION`/parâmetro `instance` no CRM.
- A sessão deve ser criada (ou atualizada via **`PUT /api/sessions/{name}`**, ex.: `PUT /api/sessions/ROMA_1`) com o
  **webhook** apontando para `https://<app-vercel>/api/webhooks/waha`, eventos:
  `message.any`, `message.ack`, `session.status` (ver `docs/plano-implementacao-waha.md` Fase 4).
  ⚠️ **`message.any` e não `message`**: o evento `message` só dispara para mensagens
  **recebidas** — com ele, o que o vendedor manda pelo celular não aparecia no CRM (bug de23/09).
  `message.any` cobre os dois sentidos; **`fromMe:true` indica só a direção — o CHAT está
  SEMPRE em `from`** (`to` é sempre o próprio usuário; usar `to` fazia o grupo virar
  "Cliente 556234165014", bug de 23/09, e o guard de grupo nunca disparava);
  o dedup por `whatsapp_message_id` evita duplicar o que o próprio CRM enviou.
  Formato confirmado em produção: `{"config":{"engine":"GOWS","webhooks":[{"url":"...","events":[...]}]}}`
  — `config.webhooks` é **lista**; após o PUT a sessão vai `STARTING`→`WORKING` **sem novo QR** (login preservado).
- Teste de envio manual:
  ```bash
  curl -s -X POST $GW/api/sendText -H "X-Api-Key: $K" -H "Content-Type: application/json" \
    -d '{"session":"ROMA_N","chatId":"55DDNUMERO@c.us","text":"Teste CRM ROMA"}'
  ```

## 5. Comandos de manutenção

```bash
docker ps --filter name=waha          # no Web console do hPanel: container rodando?
docker logs --tail 50 waha           # logs
docker restart waha                  # reiniciar o WAHA inteiro (sessões persistem no volume)
curl -s -H "X-Api-Key: $K" $GW/api/sessions   # listar todas as sessões + status
```
