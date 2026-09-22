# Pesquisa WAHA — Integração WhatsApp da aba ATENDIMENTOS

> **Escopo:** apenas a aba **ATENDIMENTOS** (simulador de WhatsApp do CRM, sem complicação).
> Fora do escopo: BotConversa, cardápio/STK-1, AI Sales (mencionado só onde toca no fluxo).
> **Data:** Setembro/2026 · Gerado a partir da varredura dos `.md` do projeto + pesquisa web com fontes.

---

## 1. O que a aba ATENDIMENTOS usa hoje (mapa interno)

Superfície de integração WhatsApp tocada pelo ATENDIMENTOS, extraída do código e dos docs do projeto:

| Área | Arquivo | Uso |
|---|---|---|
| Cliente da API | `lib/evolution-api.ts` | `enviarMensagemWhatsApp` (sendText), `enviarMidiaWhatsApp` (sendMedia), `enviarAudioWhatsApp` (sendWhatsAppAudio/PTT), `verificarStatusInstancia` (connectionState), `listarInstancias` (fetchInstances), `checkWhatsAppNumbers`, `findContacts`, `formatarTelefone` |
| Recebimento | `app/api/webhooks/evolution/route.ts` | Webhook `messages.upsert` → extrai telefone/mídia, dedup por `whatsapp_message_id`, upload de mídia para Supabase Storage, cria/atualiza atendimento, dispara AI Sales |
| Envio pelo chat | `app/api/atendimentos/mensagens/route.ts` | `remetente === "vendedor"` → envia via Evolution API |
| Mídia recebida | `app/api/media-download/route.ts` | `getBase64FromMediaMessage` para decriptar CDN do WhatsApp (`mmg.whatsapp.net`) |
| Contatos | `app/api/whatsapp/contacts`, `check-number` | Modal "Novo Contato" (`buscar-contatos-whatsapp.tsx`) |
| UI | `components/features/atendimento/chat-inline.tsx` | Visual WhatsApp Web, polling de 15s, mídias, áudio (MediaRecorder → PTT), transferência |
| Docs internos | `docs/busca-contatos-whatsapp.md`, `docs/chat-inline-redesign.md`, `docs/api-reference.md` (§21–28), `MIGRATE_AUDIO.md`, `MIGRATE_ROTEAMENTO.md` | Especificações do fluxo |

**Débitos técnicos já documentados no projeto** (relevantes para a troca):

- Instância `ROMA_1` **hardcoded** em `findContacts`/`checkWhatsAppNumbers` (`docs/busca-contatos-whatsapp.md` §8.1).
- JIDs `@lid` não resolvem para número real — quebra envio posterior (§8.2).
- Checkmarks do chat são **sempre ✓✓** — falta status real de entrega/leitura (`docs/chat-inline-redesign.md`, "Notas para Próximas Tasks").
- `formatarTelefone` duplicado entre `lib/evolution-api.ts` e `lib/botconversa.ts` (§8.5).
- `MIGRATE_AUDIO.md`: coluna `url_audio` para áudios recebidos.

## 2. WAHA: o que é e de onde vem o "plug and play"

**WAHA** é uma REST API de WhatsApp (self-hosted) que se instala em servidor próprio e roda em menos de 5 minutos — o único pré-requisito é Docker instalado.[1] O quick start oficial resume o caminho: `docker pull devlikeapro/waha` → `docker run` com um `.env` de credenciais gerado por um comando (`init-waha`) → Dashboard + Swagger em `localhost:3000`.[2]

Fluxo de conexão do número (o "plug and play" de verdade):

1. `POST /api/sessions` cria a sessão (ex.: `{"name": "default"}`).[2][6]
2. Sessão entra em `SCAN_QR_CODE` — o QR aparece no Dashboard (ícone de câmera) ou via `POST /api/{session}/auth/qr` / `GET /api/screenshot`.[2][6]
3. Escaneia com o WhatsApp do celular → status `WORKING`.[2][6]
4. Já dá para enviar: `POST /api/sendText` com `chatId` no formato `5562999999999@c.us`.[2]

Ou seja: **um container, sem banco de dados separado, sem Redis, com Dashboard, Swagger e Event Monitor embutidos** — é isso que gera a percepção de "sem configuração pesada" frente à Evolution.

### Recursos que interessam ao ATENDIMENTOS

- **Envio:** `sendText`, `sendImage`, `sendFile`, `sendVoice` (nota de voz/PTT), `sendVideo`, `sendSticker`, `sendSeen`, `startTyping`/`stopTyping` — suporte por engine documentado na página de envio.[7]
- **Recebimento:** eventos `message`, `message.any`, `message.reaction`, `message.ack`, `message.revoked`, `session.status`.[8][9]
- **Webhook com mídia resolvida:** o payload traz `hasMedia` e `media.url` — o WAHA baixa a mídia e disponibiliza via Media Storage, sem precisar de passo extra de decrypt/base64.[8]
- **Status real das mensagens:** `message.ack` informa `ackName`: ERROR (−1), PENDING (0), SERVER (1), DEVICE (2), READ (3), PLAYED (4).[9] Resolve exatamente o débito dos "checkmarks sempre ✓✓".
- **Contatos:** `GET /api/contacts/all` (agenda), `GET /api/contacts/check-exists?phone=...` (retorna `numberExists` + `chatId` — recomendado antes de mandar mensagem para número novo), `GET /api/contacts/profile-picture`.[10]
- **Webhooks por sessão** no próprio `POST /api/sessions` (`config.webhooks[].url` + `events`), com HMAC, retries e custom headers; ou webhooks globais por variável de ambiente (`WHATSAPP_HOOK_URL`, `WHATSAPP_HOOK_EVENTS=*`).[8][9]
- **Multi-sessão:** endpoints de `start`/`stop`/`restart`/`logout` por sessão; eventos `session.status` para reconexão.[6]

### Gratuidade — ponto que mudou recentemente

Desde a versão **2026.6.1**, tudo que era WAHA Plus (sessões ilimitadas, mensagens multimídia, todos os storages, segurança embutida) passou a fazer parte do **WAHA Core — 100% gratuito**; não há mais imagem Plus separada, só `devlikeapro/waha`.[11] O tier "Community" (US$ 5/mês) é apoio ao projeto, não desbloqueio de função.[5][11]

⚠️ **Fontes divergentes:** um comparativo de terceiros (SocialMate, que vende produto concorrente) ainda afirma que o Core seria limitado a 1 sessão e envio só de texto, com Plus a ~US$ 19/mês.[4] Isso **contradiz a documentação oficial**[11] e foi confirmado de forma independente pela Wafly ("WAHA ficou grátis de verdade na versão 2026.6.1").[5] Peso maior: documentação oficial + corroboração independente; a página da SocialMate está desatualizada e tem conflito de interesse declarado.

### Engines

WAHA expõe a mesma API HTTP sobre várias engines — WEBJS (navegador), WPP, GOWS (WebSocket Go), NOWEB (WebSocket Node), VENOM — e recursos/webhooks variam conforme a engine.[12] A Wafly recomenda evitar WEBJS em produção (cada sessão custa um Chromium, ~387 MB de RAM citados) e usar GOWS/NOWEB, bem mais leves.[5] A própria discussão comunitária sobre "EVOLUTION vs WAHA" elogia o GOWS ("meow") por performance.[3]

## 3. Mapeamento Evolution API → WAHA (só o que o ATENDIMENTOS usa)

| Hoje (Evolution) | No WAHA | Observação |
|---|---|---|
| `POST /message/sendText/{instance}` | `POST /api/sendText` | `chatId = 5562...@c.us` em vez de `number` |
| `POST /message/sendMedia/{instance}` | `POST /api/sendImage` / `sendFile` / `sendVideo` | payload com `file` (URL ou base64) |
| `POST /message/sendWhatsAppAudio/{instance}` | `POST /api/sendVoice` | nota de voz (PTT) |
| `GET /instance/connectionState/{instance}` | `GET /api/sessions/{name}` + evento `session.status` | elimina o retry de `fetchInstances` |
| `POST /chat/whatsappNumbers/{instance}` | `GET /api/contacts/check-exists?phone=...` | retorna `numberExists` + `chatId` |
| `POST /chat/findContacts/{instance}` | `GET /api/contacts/all` | agenda de contatos |
| Webhook `messages.upsert` + parser `extrairDadosEvolutionAPI` | eventos `message` / `message.any` | payload já normalizado |
| `POST /chat/getBase64FromMediaMessage` (`/api/media-download`) | **não precisa** | `media.url` vem no webhook[8] |
| (não existe — débito) | `message.ack` | checkmarks reais ✓/✓✓/✓✓ azul |

Mudanças de formato a calibrar: `chatId` com sufixo `@c.us`; internamente GOWS/NOWEB podem reportar `@s.whatsapp.net` no `_data` (converter para `@c.us` ao enviar).[8] A armadilha `@lid` do projeto continua existindo — vale resolver o número real antes de criar atendimento, como já recomenda `docs/busca-contatos-whatsapp.md` §8.2.

## 4. Por que WAHA é mais "plug and play" que a Evolution API

1. **Infra:** 1 container Docker vs Docker + PostgreSQL + Redis na Evolution.[4]
2. **Onboarding:** Dashboard + Swagger + Event Monitor embutidos para escanear QR e ver eventos chegando em tempo real — o tutorial oficial leva do zero à primeira mensagem em 6 passos.[2][8]
3. **Configuração de webhook** no próprio JSON de criação da sessão, com HMAC e retries.[8]
4. **Payload pronto para consumo:** mídia baixa/resolvida (`media.url`), `pushName`, `replyTo` — menos parser no CRM.[8]
5. **Engines flexíveis:** se uma engine instabilizar, troca-se a engine sem reescrever a integração.[3][5][12]
6. **Projeto ativo:** commits recentes e releases regulares (a Wafly registrou push em 21/08/2026 e ~7,2 mil estrelas).[5] Na discussão oficial, o mantenedor argumenta revisão de PRs mais disciplinada e codebase mais organizada que a Evolution[3] — *opinião do mantenedor, contar como sentimento, não como fato medido*.

## 5. Riscos e cuidados (as duas são não-oficiais)

- **Ban é sempre possível** em qualquer ferramenta não-oficial — WhatsApp exige meios autorizados; a própria documentação do WAHA dedica um guia "How to Avoid Blocking".[4][5][13] Para um simulado/atendimento humano com volume baixo, o risco é o mesmo da Evolution.
- **Sessão cai, QR expira, protocolo muda** — existe o "custo de plantão" do self-host.[5] Com o WAHA, o evento `session.status` + Dashboard deixam isso visível.[6]
- **WEBJS consome RAM de navegador** — para a VPS atual, prefira GOWS ou NOWEB.[5]
- **Backup da sessão:** persistir o volume `sessions` (`-v ./sessions:/app/.sessions`) para não re-escanear QR a cada deploy.[2]

## 6. Recomendação para o ATENDIMENTOS ("simulado sem complicação")

A escolha **WAHA se confirma** como a mais simples para o objetivo:

1. Subir `devlikeapro/waha` com engine **GOWS** (ou NOWEB), 1 sessão (substitui `ROMA_1`; matar o hardcode e usar variável `WAHA_SESSION`).
2. Webhook no `POST /api/sessions` apontando para uma rota `/api/webhooks/waha` (adaptada do `webhooks/evolution/route.ts`) com eventos `message`, `message.ack`, `session.status`.
3. Reescrever `lib/evolution-api.ts` → `lib/waha.ts` com ~6 funções (sendText, sendImage/File/Video, sendVoice, check-exists, contacts/all, session status).
4. **Eliminar** `app/api/media-download` (decrypt) — usar `media.url` do webhook, com upload para Supabase Storage como hoje.
5. Bônus quase grátis: `message.ack` → checkmarks reais no `chat-inline.tsx` (débito já aberto no doc do chat).
6. Manter o resto do fluxo (Supabase, atendimentos, polling 15s, roteamento de vendedor) intacto — a troca é só na borda de WhatsApp.

Esforço estimado: concentrado em 3 arquivos (`lib/`, webhook, `chat-inline.tsx`); o modelo de dados e a UI não mudam.

## Sources

[1] https://github.com/devlikeapro/waha — WAHA - GitHub
[2] https://waha.devlike.pro/docs/overview/quick-start — WAHA Quick Start
[3] https://github.com/devlikeapro/waha/discussions/1181 — EVOLUTION vs WAHA - Discussion #1181
[4] https://socialmate.app/blog/evolution-api-vs-waha — Evolution API vs WAHA - SocialMate
[5] https://wafly.com.br/comparativos/waha-vs-evolution-api — WAHA ou Evolution API - Wafly
[6] https://waha.devlike.pro/docs/how-to/sessions
[7] https://waha.devlike.pro/docs/how-to/send-messages
[8] https://waha.devlike.pro/docs/how-to/receive-messages
[9] https://waha.devlike.pro/docs/how-to/events
[10] https://waha.devlike.pro/docs/how-to/contacts
[11] https://waha.devlike.pro/docs/how-to/waha-plus
[12] https://waha.devlike.pro/docs/engines
[13] https://waha.devlike.pro/docs/overview/how-to-avoid-blocking
