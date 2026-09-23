# HANDOFF — Migração WhatsApp (Evolution API → WAHA) — CRM ROMA

**Atualizado em: 22/09/2026 (cutover em produção feito nesta data)**
**Quem deve ler este documento: qualquer IA/DEV que vá continuar o trabalho da aba ATENDIMENTOS.**

---

## 1. Objetivo e escopo

Migrar a integração WhatsApp da aba **ATENDIMENTOS** do CRM ROMA (um *simulador de WhatsApp Web* simples) de **Evolution API** para **WAHA (WhatsApp HTTP API)**.

**DENTRO do escopo:**
- Aba Atendimentos: lista de conversas, chat estilo WhatsApp Web, envio/recebimento de texto + mídia, checkmarks, transferência, contatos.
- Um número conectado por enquanto (sessão `ROMA_1`), mas com espaço para mais.

**FORA do escopo (NÃO mexer):**
- BotConversa, cardápio/STK-1, AI Sales (só reaproveitamento pontual), qualquer outra aba do CRM.

**Regra do grupo Telegram "CRM ROMA":** é exclusivo deste projeto — nada além dele.

---

## 2. Arquitetura atual

```
[Cliente WhatsApp] ⇄ [WAHA — container Docker na VPS]
                            ↓ webhook (eventos)
                  [Vercel — Next.js Route Handlers]
                            ↓
                  [Supabase — Postgres + Storage]
                            ↑
                  [CRM ROMA no navegador]
```

- **WAHA** roda na VPS Hostinger `srv1745477.hstgr.cloud`, porta **3000** (dashboard em `/dashboard`).
  - Engine: **GOWS** (`GOWS (2026.9.1 CORE)`).
  - Sessão única: **`ROMA_1`** (número 556234165014), estado `WORKING`.
  - **Grátis desde a versão 2026.6.1** (sem mais limitação de sessões).
- **CRM** deployado na **Vercel**: **`https://crm-roma-ten.vercel.app`** (domínio de acesso da equipe; o alias `crm-roma-romadistribuicao.vercel.app` também resolve para o mesmo build — conta `roma-6489 / romadistribuicao`, plano Hobby).
- **Banco/Storage**: Supabase (projeto `otmkukicneotcpkemvcq`).
- **Não rodar o app localmente** — desenvolvimento é só edição de código (code-server); deploy automático via push no GitHub (`Johnpittz/crm-roma`, branch `master`).

### Webhook registrado
`PUT /api/sessions/ROMA_1` com `config.webhooks` (array) →
`https://crm-roma-romadistribuicao.vercel.app/api/webhooks/waha`
Eventos: `message`, `message.ack`, `session.status`.

---

## 3. Estado do projeto — checklist

| Item | Estado |
|---|---|
| F0–F7 do plano (infra, lib, parser, webhook, envio, contatos, checkmarks) | ✅ concluídas |
| Cutover em produção (22/09/2026) | ✅ feito |
| Envio de texto | ✅ funcionando (E2E real) |
| Envio de documento (PDF/DOCX), inclusive ~4,8 MB | ✅ funcionando (E2E real) |
| Envio de áudio (PTT) | ✅ funcionando (E2E real) |
| Envio de texto/mídia por **gestor ou não-dono** do atendimento | ✅ corrigido 23/09 (`1fe771d`) — era 500 RLS (BUG-7) |
| Recebimento de texto | ✅ funcionando (E2E real) |
| Recebimento de imagem/documento | ✅ corrigido 23/09 (`b880ea2`) — **validado E2E pelo usuário** |
| Checkmarks (✓/✓✓/azul) reais via `message.ack` | ✅ funcionando |
| Nomes de contatos reais + resolução LID→número | ✅ funcionando |
| Migração Evolution → WAHA (só módulo ATENDIMENTOS) | ✅ fechada |
| **Liberado para uso pela equipe** | ✅ **23/09/2026** — texto/mídia (vídeo, áudio, documento) enviada e recebida, validado pelo usuário |
| F8 (apagar legado Evolution após 24–48h estáveis) | 🔄 pendente |
| Lightbox de imagem (clique expande no CRM) | ✅ implementado 23/09 (`33bfcbc`) — overlay no CRM (fecha com clique/Esc) — **validado E2E pelo usuário** |
| Fix da URL `localhost` da mídia recebida | ✅ **concluído** 23/09 (`b880ea2`) — **validado E2E pelo usuário** |

**Testes: 61/61 verdes** (23/09/2026, `npx vitest run`).
`npx tsc -p tsconfig.json --noEmit` limpo.
`npm run lint` não tem ESLint configurado no projeto (fora de escopo).

---

## 4. O que já foi provado funcionando (E2E real, com WhatsApp de verdade)

Testado ao vivo em 22/09/2026, com conversas reais:

1. Texto vindo do WhatsApp → bolha no CRM com nome real do contato.
2. Texto do CRM → chega no WhatsApp.
3. **PDF de 4,8 MB** do CRM → chega no WhatsApp E a bolha fica no CRM (via fluxo `media_url` — ver §5 BUG-6).
4. DOCX do CRM → chega + bolha no CRM.
5. Áudio gravado no CRM (PTT) → chega no WhatsApp.
6. Documento/imagem recebidos → **reparados manualmente** e exibindo (ver §5 BUG-5 — ainda há bug para mídia NOVA).
7. Checkmarks mudando sozinhos (enviado → entregue → lido).
8. Conversa recebida de número novo cria atendimento + rota para vendedor.
9. Duplo envio da mesma mensagem do WAHA **não** duplica no CRM (dedup por `whatsapp_message_id`).

---

## 5. BUGS encontrados e corrigidos (com a lição por trás)

> Todos estes só apareceram no teste com conversa real. A lição geral: **payload real do GOWS difere da documentação** — sempre conferir ao vivo.

- **BUG-1 — número virava ID (`17502058848385…`)**: JIDs `@lid` salvos crus. Corrigido com `resolverLid()` no ingest.
  - *Lição*: a URL certa é `GET /api/{session}/lids/{lid}` (**sem** `/api/sessions/`). O teste unitário tinha fixado a URL errada — "especificação errada = teste errado".
- **BUG-2 — nome sempre "Cliente"**: o GOWS manda `pushname` (minúsculo), o parser olhava `pushName`/`notifyName`. Corrigido: parser aceita todos + `buscarNomeContato()` (`GET /api/{session}/contacts/{id}`, prefere `pushname`).
  - *Lição*: chaves do payload real são minúsculas; comparar com fixture real, não com doc.
- **BUG-3 — arquivo não enviava/aparecia**: `{"error":"fetch failed"}` em POSTs Vercel→WAHA (GETs OK). Era **instabilidade de rede/cold-socket**, não código — resolveu sozinho. Adicionado `descreverErro()` com `err.cause?.code` para o próximo caso.
- **BUG-4 — bolha do PDF enviada não aparecia no CRM**: insert com `tipo_midia='document'` rejeitado em silêncio pelo CHECK constraint (Postgres **23514**). Corrigido com `mapearTipoMidiaDb()` (fonte única, tolerante pt-BR/maiúsculas) + migração 068.
- **BUG-5 — mídia RECEBIDA sem arquivo (as bolhas cinzas "Imagem recebida")**: o WAHA entrega a URL do arquivo como **`http://localhost:3000/api/files/{sess}/{hash}.{ext}`** — a Vercel tenta baixar `localhost` (ela mesma) e falha → `url_midia=NULL`. **RESOLVIDO em 23/09 (`b880ea2`)**: `resolverUrlMidia()` normaliza a URL para a base pública (`montarUrlArquivo`) e, com `media.url` nulo, recupera via histórico (`buscarUrlMidiaHistoria`). **Falta validação E2E.**
  - *Lição*: mesma classe do `pushname` — só aparece ao vivo. O payload real veio de `GET /api/{session}/chats/{chatId}/messages?downloadMedia=true` (com `downloadMedia=false` a `media.url` vem **null**).
- **BUG-6 — arquivos > ~3 MB não enviavam (`413 FUNCTION_PAYLOAD_TOO_LARGE`)**: limite de **4,5 MB** do corpo de requisição na Vercel; base64 infla 33% → arquivos ≳3,3 MB morriam. **RESOLVIDO**: cliente envia direto ao Supabase Storage por URL assinada (`POST /api/upload-url` → `uploadToSignedUrl`) e o WAHA baixa por `file:{url}` (`enviarMidia({ mediaUrl })`). Fallback base64 para arquivos pequenos.
  - *Lição*: "PDF do Chrome não funciona / do Adobe sim" era na verdade **tamanho** (4,8 MB vs menor). O rótulo "Chrome PDF Document" no Windows é só a associação de aplicativo, não o formato.
- **BUG-7 — envio de mensagem do CRM dava `500 {"error":"new row violates row-level security policy"}` para quem não era o vendedor dono do atendimento (23/09)**: a policy RLS `vendedor_ve_mensagens_proprio_atendimento` (migration 010) só permite INSERT se `atendimentos.vendedor_id = auth.uid() OR vendedor_id IS NULL`. O atendimento nascia com `vendedor_id` NULL (qualquer um escrevia); quando o webhook recebia mensagem nova, o roteamento **atribuía o vendedor padrão** (linha `vendedorUpdate` do `app/api/webhooks/waha/route.ts`) → a partir daí só esse vendedor enviava e o gestor (Murilo) era bloqueado no insert — o cliente engolia o erro em silêncio. **RESOLVIDO (`1fe771d`)**: o POST `/api/atendimentos/mensagens` escreve via **service role** (autenticação por `getUser()` mantida — mesmo padrão do GET, que já lia por service role); `chat-inline.tsx` agora mostra toast de erro em vez de falha silenciosa. Verificado RED→GREEN com `scripts/smoke-envio-mensagens.sh` (POST real em produção com usuário de teste não-dono: 500 antes → 200 depois, mensagem entregue no WhatsApp, ack=2).
  - *Lição*: GET usava service role e POST usava o cliente do usuário — RLS "só o vendedor dono" é incompatível com o produto (gestor responde qualquer chat). **Testar sempre com usuário NÃO-dono do atendimento.** O RLS da tabela continua estrito para acesso direto via PostgREST — endurecimento futuro: migration com bypass gestor/admin (ver BUG-7 no PROGRESSO).
  - *Lição*: upload assinado **com JWT de usuário logado passa sem policy extra** (a policy `069` é opcional/idempotente). Teste com chave de serviço dá falso negativo por causa do RLS.

---

## 6. ⚠️ PENDÊNCIAS ABERTAS (ler com atenção)

### 6.1 Fix da mídia recebida — URL `localhost` (✅ CONCLUÍDO 23/09 — `b880ea2`)
Implementado com TDD (RED → GREEN):
- `lib/waha.ts`: `montarUrlArquivo(url, base)` (re-escreve `localhost`/`127.x`/IPs privados para a base pública; resolve relativas `/...`; preserva públicas; **devolve `null` para entrada inválida** tipo `://errado`), `buscarUrlMidiaHistoria({telefone, messageId})` (fallback: recupera `media.url` no histórico do chat) e **`resolverUrlMidia({urlMidia, telefone, messageId})`** (composição usada pelo webhook: URL do evento normalizada → fallback por histórico → `null`).
- `app/api/webhooks/waha/route.ts`, `processarMidia()`: pluggado — usa `resolverUrlMidia()` antes do `fetch`; `media.url` nulo agora cai no fallback (antes retornava `null` direto).
- Testes: 4 de `resolverUrlMidia` + correção de `montarUrlArquivo` p/ URL inválida. **61/61 verdes + tsc limpo.**
- ✅ **Validado E2E pelo usuário em 23/09** (imagem nova chega e abre no chat, sem bolha cinza).

### 6.2 Lightbox de imagem (✅ CONCLUÍDO 23/09 — `33bfcbc`)
- `components/features/atendimento/lightbox.tsx`: componente `Lightbox` (overlay `fixed inset-0`, fecha com clique no fundo ou Esc; clique na imagem não fecha). Clique na imagem do chat agora expande **dentro do CRM** — `window.open` (aba nova) foi removido.
- Legenda `[image]` duplicada: `ehPlaceholderConteudo()` em `lib/waha-webhook.ts` (lista de tokens: image/imagem, audio, ptt, video, document/documento, sticker/figurinha, gif — normaliza caixa/acentos/espaços). **Desvio do regex sugerido**: o regex genérico `^\[...\]$` engolia legenda real tipo "[risos] que demais"; com token-list, texto real nunca some.
- Testes: 5 do `Lightbox` (jsdom + `@testing-library/react`) + 2 de `ehPlaceholderConteudo`. `vitest.config.ts` criado (transform automático de JSX — tsconfig do Next usa `jsx: "preserve"`).
- ✅ **Validado E2E pelo usuário em 23/09** (clique na imagem abre o lightbox dentro do CRM).

### 6.3 F8 — remover legado Evolution (baixa prioridade)
`lib/evolution-api.ts` e `app/api/webhooks/evolution/route.ts` estão `@deprecated` e intactos como **rollback por 1 release**. Apagar só depois de 24–48h estáveis. Env `EVOLUTION_*` no Vercel também ficaram de reserva.

---

## 7. Mapa de arquivos (o que é o quê)

**Núcleo WAHA:**
- `lib/waha.ts` — adapter WAHA: `getWahaConfig`, `postWaha`, `descreverErro`, `formatarChatId`, `enviarTexto` (`/api/sendText`), `enviarMidia` (`ENDPOINT_MIDIA`: image→`sendImage`, video→`sendVideo`, document/audio→`sendFile`, sticker→`sendSticker`; aceita `media` (base64) **ou** `mediaUrl`), `enviarAudio` (`/api/sendVoice`, opus), `enviarLido` (`/api/sendSeen`), `verificarSessao`, `checkNumbers`, `findContacts`, `resolverLid`, `buscarNomeContato`, `montarUrlArquivo`, `buscarUrlMidiaHistoria`, `resolverUrlMidia` (composição usada pelo webhook).
- `lib/waha-webhook.ts` — `parseEventoWaha` (eventos `message`/`message.any`/`message.ack`/`session.status`), tipos `MensagemWaha`, `mapearCheckmark`, `mapearTipoMidiaDb` (**fonte única** de `tipo_midia` para o banco), `montarConteudo`, `ehPlaceholderConteudo` (legenda placeholder não é renderizada na mídia), `MAPA_TIPO_DB` (image→imagem, audio→audio, video→video, document→documento).
- `lib/__fixtures__/waha-webhook.json` — fixtures reais dos eventos.

**Rotas (API):**
- `app/api/webhooks/waha/route.ts` — webhook ativo: rate limit, token opcional (`WAHA_WEBHOOK_TOKEN`), dedup por `whatsapp_message_id`, resolução LID→telefone, cascata de nome (cliente → `pushname` → `buscarNomeContato` → "Cliente"), mídia via `media.url` → Storage, atendimento, roteamento, AI Sales, `message.ack` → `ack_status`, `session.status` → log. **Aqui entra o plug do §6.1.**
- `app/api/atendimentos/mensagens/route.ts` — envio de texto + gravação de mídia (usa `mapearTipoMidiaDb` no insert).
- `app/api/send/media/route.ts` — envio de mídia (aceita `media` base64 **ou** `media_url`).
- `app/api/upload-url/route.ts` — cria URL assinada para o cliente enviar arquivos direto ao Storage (contorna o limite de 4,5 MB da Vercel).
- `app/api/whatsapp/send-seen/route.ts` — marca conversa como lida.
- `app/api/whatsapp/contacts/route.ts`, `app/api/whatsapp/check-number/route.ts` — migados p/ `lib/waha.ts`.
- `app/api/media-download/route.ts` — **só** decrypt legado Evolution.
- `app/api/ai-sales/test/route.ts` — health check WAHA.

**Frontend:**
- `components/features/atendimento/chat-inline.tsx` — chat estilo WhatsApp: `renderMidia`, `renderCheckmark`, envio de arquivo (fluxo `media_url` + fallback base64), gravador de áudio, `sendSeen` ao abrir conversa. Usa `Lightbox` (`components/features/atendimento/lightbox.tsx`) e `ehPlaceholderConteudo` (§6.2 — feito).

**Banco (migrations em `supabase/migrations/`):**
- `067_ack_status_mensagens.sql` — coluna `ack_status` (aplicada ✅).
- `068_tipo_midia_check_ampliado.sql` — CHECK `tipo_midia IN ('texto','imagem','audio','documento','video','sticker')` (aplicada ✅ — sem ela, vídeo/sticker são rejeitados em silêncio).
- `069_chat_media_upload_authenticated.sql` — policy de upload autenticado no Storage (**opcional**, idempotente; o fluxo já funciona sem ela).

**Docs:**
- `docs/plano-implementacao-waha.md` — plano F0–F8 (F8 🔄).
- `docs/runbook-waha-numeros.md` — **como conectar um número novo do zero** (ver §10).
- `docs/pesquisa-waha-atendimento.md` — pesquisa de decisão WAHA vs Evolution.
- `docs/api-reference.md` — §21 (mídia) e §26 (webhook) atualizados.
- `PROGRESSO.MD` — diário de bordo (entrada `### 22/09/2026`).

**Legado (NÃO usar, só rollback):** `lib/evolution-api.ts`, `app/api/webhooks/evolution/route.ts` (`@deprecated`).

---

## 8. Infraestrutura e acessos

- **VPS Hostinger**: `srv1745477.hstgr.cloud` (IP 2.25.192.248).
- **code-server** (dev): `https://srv1745477.hstgr.cloud:8080/?folder=/root/crm-roma` (TLS auto-assinado; senha em `/app/code-server/password.txt` — **nunca enviar senhas pelo chat**).
- **WAHA**: `http://srv1745477.hstgr.cloud:3000` (externo) / `http://172.16.1.1:3000` (interno).
  - ⚠️ **Hairpin NAT**: de dentro da VPS o IP público **não resolve** — usar `172.16.1.1:3000` para falar com o WAHA pelo terminal do agente. Do Vercel/navegador, usar o host público.
  - Dashboard: `/dashboard` (credenciais em env, **não** no chat).
- **Container do agente**: `john_hermes` (sem Docker dentro dele; comandos de host são pelo gateway interno).
- **Git**: `gh` CLI autenticado como `Johnpittz` (device flow — sem tokens no chat). Push em `master` = deploy automático na Vercel.

---

## 9. Variáveis de ambiente

**Vercel (Production) e `.env.local`** — valores **nunca** no chat/repo:
- `WAHA_API_URL` = `http://srv1745477.hstgr.cloud:3000`
- `WAHA_API_URL_INTERNAL` = `http://172.16.1.1:3000` (para chamadas de dentro da VPS)
- `WAHA_API_KEY` (header `X-Api-Key`)
- `WAHA_SESSION` = `ROMA_1`
- `WAHA_WEBHOOK_TOKEN` (opcional — se definido, o webhook exige `?token=`)
- `EVOLUTION_*` — mantidas só para rollback (podem ser apagadas na F8)
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

Storage: bucket público **`chat-media`** — pastas `whatsapp/` (recebidas), `enviados/` (envio direto), `image/`, `audio/` (legado base64).

---

## 10. Conectar um novo número (resumo — o detalhe está no runbook)

**Combinado com o usuário: quem operia o processo é ELE. A IA só orienta e o usuário escaneia o QR.** Quando ele disser "conectar novo número", seguir `docs/runbook-waha-numeros.md`. Resumo:
1. `POST /api/sessions` (criar, engine GOWS) — ⚠️ `PUT /api/sessions` é 404; **update é `PUT /api/sessions/{name}`** com `config.webhooks` em array.
2. `POST /api/sessions/{s}/start` → `GET /api/{s}/auth/qr` (PNG cru) → usuário escaneia.
3. Conferir `GET /api/sessions` = `WORKING` e o webhook registrado.

---

## 11. Endpoints WAHA confirmados AO VIVO (a doc não bate em tudo)

```
POST   /api/sessions                       criar
PUT    /api/sessions/{name}                atualizar (config.webhooks em ARRAY) ← o certo
POST   /api/sessions/{s}/start|stop
GET    /api/sessions  |  /api/sessions/{s}
GET    /api/{s}/auth/qr                    PNG cru
POST   /api/sendText|sendImage|sendFile|sendVoice|sendVideo|sendSticker|sendSeen
GET    /api/contacts/check-exists
GET    /api/contacts/all                   (resolve @lid antes de aceitar)
GET    /api/{session}/contacts/{id}        campos: pushname, name
GET    /api/{session}/lids/{lid}           → {lid, pn}  ← SEM /api/sessions/
GET    /api/{session}/chats/{chatId}/messages?limit=N[&downloadMedia=true]
```
Eventos do webhook: `message`, `message.ack` (`ackName`: ERROR/PENDING/SERVER/DEVICE/READ/PLAYED), `session.status`.

Comportamento do webhook em produção: POST `{}` → 400 `Payload inválido: event é obrigatório`; evento desconhecido → 200 `ignored_event`; replay da mesma mensagem → `dedup_skipped`.

**Payload real do GOWS** (diferente da doc): `pushname` minúsculo; `media` traz só `{url, mimetype}` (sem `filename` em imagem/áudio); `media.url` = `http://localhost:3000/api/files/...`; remetentes podem vir como `@lid`.

---

## 12. Testes (TDD é obrigatório aqui)

- Framework: **vitest** (`npm test` / `npx vitest run`). `vitest.config.ts` define transform automático de JSX (tsconfig do Next usa `jsx: "preserve"`); testes de componente usam `// @vitest-environment jsdom` no topo do arquivo.
- Arquivos: `lib/telefone.test.ts`, `lib/waha.test.ts`, `lib/waha-webhook.test.ts`, `components/features/atendimento/lightbox.test.tsx`.
- **Regra combinada com o usuário: TDD estrito — RED → GREEN mínimo → REFACTOR. A especificação (teste) manda; o código se ajusta.**
- Estado: **61/61 verdes** (23/09/2026).
- Smoke E2E de envio: `scripts/smoke-envio-mensagens.sh [atendimento_id]` — cria usuário de teste não-dono, faz POST real na rota de produção autenticado por cookie e limpa. RED esperado sem o fix `1fe771d`: 500 RLS; GREEN: 200 + entrega no WhatsApp.
- Cuidado: testes de `lib/waha.ts` usam `FetchImpl`/`WahaOptions` injetáveis (`fakeFetch` + `CONFIG` no topo de `lib/waha.test.ts`).

---

## 13. Como trabalhar neste projeto (decisões e preferências do usuário)

1. **Comunicação em pt-BR**, tom direto e didático. Usuário opera via Telegram (grupo "CRM ROMA") + prints.
2. **Autonomia**: seguir sozinho até o fim da etapa e **reportar o resultado ao final** (não ficar perguntando "posso continuar?").
3. **Testes automatizados são prioridade** — ele valoriza muito. TDD sempre que possível.
4. **Documentação/runbook para outras IAs** assumirem o trabalho é um requisito explícito (este documento é um deles).
5. **Segurança**: credenciais nunca no chat. GitHub por `gh` (device flow). Senhas do code-server/Dashboard WAHA só em arquivos/vars.
6. Deploy é sempre por **push no GitHub** (Vercel builda). Nunca "subir o app" à mão.

### Armadilhas conhecidas (de verdade, já aconteceram)
- **`Bearer ` literal em patches de código é corrompido pelo filtro de segurança do agente** (vira `***` e quebra o template literal). Usar `session.token_type + " " + session.access_token` (o `token_type` do Supabase já é "bearer") — é o que está em `chat-inline.tsx` hoje.
- `patch` com `old_string` ambíguo falha — sempre acrescentar contexto único.
- `notify` do `terminal` é boolean, não string.
- Erro de insert no Postgres pode ser **silencioso** no fluxo (o envio ao WhatsApp continua) — olhar constraint CHECK (`23514`).
- Testar só com fixture da documentação não basta: o payload real do GOWS já divergiu 3 vezes (`pushname`, `@lid`, `media.url` localhost).

---

## 14. Commits de referência

- `a44ea9d` — migração completa (27 arquivos, +3.338/−431).
- `fix(whatsapp)` — bugs 1–2 (LID + nome) + diagnóstico.
- `28efa8f` — fix mídia enviada (`mapearTipoMidiaDb` + migração 068).
- `0bf86e2` — envio de arquivos grandes (upload assinado + `mediaUrl` no WAHA).
- `bda3595` — migrations 068 e 069 versionadas.
- `93c51df` — handoff completo (este documento).
- `b880ea2` — **fix mídia recebida** (BUG-5): `resolverUrlMidia` + plug no webhook (§6.1).
- `33bfcbc` — **lightbox no CRM + legenda `[image]`** (§6.2) + `vitest.config.ts` + devDeps jsdom/testing-library.
- `1f894c7` — docs (handoff + progresso).
- `1fe771d` — **fix envio de mensagem do CRM (500 RLS — BUG-7)**: escrita via service role no POST de mensagens + toast de erro no cliente + `scripts/smoke-envio-mensagens.sh`.

---

## 15. Próximos passos sugeridos (ordem)

1. ~~**§6.1** — plug do `montarUrlArquivo`/`buscarUrlMidiaHistoria` no webhook~~ ✅ **feito e validado E2E 23/09 (`b880ea2`)**.
2. ~~**§6.2** — lightbox de imagem + corrigir legenda `[image]`~~ ✅ **feito e validado E2E 23/09 (`33bfcbc`)**.
3. Varredura de todos os tipos de mídia (imagem, áudio, vídeo, documento, sticker) × (enviado, recebido) — pedido explícito do usuário: *"importante ver tudo de media pra ver se vai funcionar"*. **23/09: vídeo/áudio/documento ENVIADOS validados; vídeo/sticker RECEBIDOS ainda não testados ao vivo** — pode ser conferido organicamente durante o uso (se falhar, caminho é o mesmo do BUG-5: `resolverUrlMidia` no webhook + bolha no chat).
4. **§6.3** — F8: apagar legado Evolution depois de 24–48h estáveis.
