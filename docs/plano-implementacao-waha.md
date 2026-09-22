# Plano de Execução — WAHA na aba ATENDIMENTOS

> **Escopo:** trocar a integração WhatsApp do módulo ATENDIMENTOS (simulador de chat) de Evolution API para WAHA.
> Fora do escopo: BotConversa, cardápio/STK-1, Millennium, AI Sales (exceto o gatilho no webhook).
> **Base:** `docs/pesquisa-waha-atendimento.md` (mapa atual + pesquisa WAHA com fontes).
> **Método:** TDD (RED → GREEN → REFACTOR) por fatia vertical — cada tarefa de código nasce de um teste que falha primeiro. Test command a configurar na Fase 1 (`npm test`).

---

## Premissas (assumidas — corrija se estiverem erradas)

1. **WAHA roda na VPS** `srv1745477.hstgr.cloud` (host Docker), porta interna sem exposição pública; o Dashboard fica acessível só quando necessário (SSH tunnel ou porta protegida por `WAHA_API_KEY`).
2. **O app continua no Vercel** — o webhook WAHA → app aponta para `https://<app-vercel>/api/webhooks/waha` (URL pública).[decisão]
3. **Engine: GOWS** (WebSocket Go, sem navegador, RAM baixa, suporta tudo que o ATENDIMENTOS usa).[recomendação da pesquisa]
4. **Sessão única** com nome `ROMA_1` (mantém o nome atual para minimizar diff no código e nos docs).
5. **Cutover sem paralelo**: Evolution fica configurada mas desligada como rollback; não há operação das duas em simultâneo.
6. Não existe suite de testes hoje (scripts: dev/build/start/lint) — a Fase 1 cria a fundação.

---

## Fases

### Fase 0 — Decisões travadas (½h, sem código) ✅ CONCLUÍDA
- [x] Confirmar premissas 1–5
- [x] Definir URL pública do Vercel para o webhook *(pendente da URL final — preencher no cutover)*
- [x] Definir dono do "plantão" (sessão cai, QR expira)

**Aceite:** premissas validadas por você.

### Fase 1 — Fundação de testes (½–1 dia) ✅ CONCLUÍDA
- [x] `npm i -D vitest` + script `"test": "vitest run"` (unitário, roda em CI/local)
- [x] Teste RED inicial: `formatarTelefone` unificado (matando a duplicação `lib/evolution-api.ts` ↔ `lib/botconversa.ts` — débito `docs/busca-contatos-whatsapp.md` §8.5) — implementado em `lib/telefone.ts` com 4 testes em `lib/telefone.test.ts`
- [x] Fixture de payload de webhook WAHA (JSON real dos eventos `message`, `message.ack`, `session.status` — copiado da documentação[8][9]) em `lib/__fixtures__/waha-webhook.json`

**Aceite:** `npm test` roda verde; CI local reproduzível.

### Fase 2 — Infra WAHA na VPS (½ dia, fora do repo) ✅ CONCLUÍDA
- [x] `docker run devlikeapro/waha` com engine `WHATSAPP_DEFAULT_ENGINE=GOWS`, volume `-v ./sessions:/app/.sessions`, `.env` gerado por `init-waha` (credenciais)[2]
- [x] Criar sessão `ROMA_1` *(webhook será registrado na Fase 4, quando a URL do Vercel existir)*
- [x] Escanear QR → status `WORKING`[6]
- [x] Smoke test: `POST /api/sendText` manual via curl para um número de teste
- [x] Anotar env vars novas: `WAHA_API_URL`, `WAHA_API_KEY`, `WAHA_SESSION=ROMA_1` *(em `/root/crm-roma/.env.local`)*
- [x] Runbook de conexão de números: `docs/runbook-waha-numeros.md`

**Aceite:** mensagem de teste entregue no celular; evento `message` aparecendo no Event Monitor do Dashboard.

### Fase 3 — `lib/waha.ts` (1–2 dias, TDD) ✅ CONCLUÍDA
Adapter novo com o mesmo formato de retorno do `lib/evolution-api.ts` (as rotas não mudam de assinatura):

| Função | Endpoint WAHA |
|---|---|
| `enviarTexto` | `POST /api/sendText` (`chatId: 5562...@c.us`) |
| `enviarMidia` | `POST /api/sendImage` / `sendFile` / `sendVideo` |
| `enviarAudio` (PTT) | `POST /api/sendVoice` |
| `verificarSessao` | `GET /api/sessions/{name}` + `session.status` |
| `checkNumbers` | `GET /api/contacts/check-exists`[10] |
| `findContacts` | `GET /api/contacts/all`[10] |

- [x] Teste RED por função (mock de `fetch` injetado; testar formatação de `chatId`, tratamento de erro, retorno) → GREEN mínimo → REFACTOR — **18 testes em `lib/waha.test.ts`**
- [ ] Resolver `@lid` → número real antes de aceitar contato (débito §8.2) — *remanejado para a Fase 6 (endpoints `/api/{session}/lids` do WAHA)*
- [x] Apagar hardcode `ROMA_1` → `process.env.WAHA_SESSION`

**Aceite:** 100% dos testes verdes; `lib/waha.ts` coberto função por função.

### Fase 4 — Webhook `/api/webhooks/waha` (2 dias, TDD no parser) ✅ CONCLUÍDA (registro do webhook no cutover)
- [x] Teste RED do parser de payload WAHA (fixtures da Fase 1): extrai telefone (`@c.us`/`@s.whatsapp.net`), nome, texto, `hasMedia`/`media.url`/`mimetype`/`filename`, `replyTo`[8] — **10 testes em `lib/waha-webhook.test.ts`**
- [x] Rota reutiliza o fluxo do `webhooks/evolution/route.ts`: rate limit → dedup por `whatsapp_message_id` → upload de mídia (baixar de `media.url`) → busca/cria atendimento → roteamento para vendedor padrão (`MIGRATE_ROTEAMENTO.md`) → insert na mensagem → gatilho AI Sales (texto do cliente) — **`app/api/webhooks/waha/route.ts`**
- [x] Tratar eventos: `message`/`message.any` (ingestão), `message.ack` (status — best-effort até a coluna `ack_status` da Fase 7), `session.status` (log/alerta de desconexão)
- [x] Validação de autenticação do webhook *(adaptado: token opcional `WAHA_WEBHOOK_TOKEN` via header `X-Webhook-Token`)*[8]
- [x] Ignorar grupos (`@g.us`) como hoje

**Aceite:** replay das fixtures cria atendimento + mensagem no Supabase (teste de integração com Supabase de teste ou service role em sandbox); webhook duplicado → `dedup_skipped`. *(replay marcado para o smoke test do cutover — registrar o webhook na sessão só quando o `/api/webhooks/waha` estiver no Vercel, para não duplicar mensagens com a Evolution ainda conectada)*

### Fase 5 — Troca do envio (1 dia) ✅ CONCLUÍDA
- [x] `app/api/atendimentos/mensagens/route.ts` → `lib/waha.ts` (texto)
- [x] `app/api/send/media/route.ts` → `lib/waha.ts` (imagem/áudio PTT/vídeo/documento/sticker — sticker ganhou ciclo RED→GREEN próprio)
- [x] `app/api/media-download/route.ts`: mantido como **proxy legado** (decrypt só para mídias antigas `mmg.whatsapp.net`); **API key hardcoded removida** (melhoria de segurança)
- [x] `app/api/ai-sales/test/route.ts`: health check aponta para WAHA (`GET /api/sessions`)

**Aceite:** texto, imagem e áudio gravado chegam ao WhatsApp real a partir do chat; PDF recebido aparece no CRM (regressão do fix `file_name` do `chat-inline-redesign.md` v2). *(smoke test real marcado para o cutover/deploy)*

### Fase 6 — Contatos (½–1 dia) ✅ CONCLUÍDA
- [x] `app/api/whatsapp/contacts/route.ts` → `GET /api/contacts/all` (módulo compatível — nomes de campo preservados, componente `buscar-contatos-whatsapp.tsx` intocado)
- [x] `app/api/whatsapp/check-number/route.ts` → `GET /api/contacts/check-exists` (retorna `numberExists` + `chatId`)[10]
- [x] Modal `buscar-contatos-whatsapp.tsx`: **sem alteração necessária** — `findContacts` mantém `pushName`/`profilePicUrl` na borda
- [x] **Débito §8.2 quitado:** `resolverLid()` (`GET /api/{session}/lids/{lid}` → `{lid, pn}`)[10] aplicado no `findContacts` — JIDs `@lid` resolvidos para o número real antes de aceitar o contato
- [x] `isSaved` derivado da presença de `name` (§8.3) — contatos sem nome no WhatsApp aparecem como não-salvos (comportamento preservado)

**Aceite:** checklist de `docs/busca-contatos-whatsapp.md` §10 passando (adaptação: §10.5 "API Key inválida" → `WAHA_API_KEY`). *(smoke test real no cutover)*

### Fase 7 — Checkmarks reais + brindes (1 dia, opcional mas barato) ✅ CONCLUÍDA (aplicar migration)
- [x] Migration `067_ack_status_mensagens.sql`: `ALTER TABLE atendimento_mensagens ADD COLUMN ack_status TEXT` (valores: `pending|server|device|read|played|error`)[9] — **executar no SQL Editor do Supabase para ativar**
- [x] Webhook WAHA: grava `message.ack` → `ack_status` (best-effort, já implementado na Fase 4)
- [x] `chat-inline`: `renderCheckmark(msg.ack_status)` — ✓ cinza (enviando) → ✓✓ cinza (entregue) → ✓✓ azul (lido) → ✓ vermelho (erro); `sendSeen` ao abrir conversa (nova rota `POST /api/whatsapp/send-seen` → `enviarLido()` em `lib/waha.ts`)
- [x] Testes do mapper (`mapearCheckmark`: WAHA ack → estado do checkmark) + `enviarLido` (POST `/api/sendSeen`) — ciclo RED→GREEN

**Aceite:** envio para um número de teste mostra a progressão ✓ → ✓✓ → ✓✓ azul de verdade. *(smoke real no cutover; sem a migration aplicada as mensagens do vendedor mostram ✓ cinza)*

### Fase 8 — Cutover, deploy e documentação (1 dia) 🔄 EM ANDAMENTO
- [x] Vercel: `WAHA_API_URL`, `WAHA_API_KEY`, `WAHA_SESSION` adicionadas (**ação do usuário, 22/09**); `EVOLUTION_*` mantidas como rollback
- [x] Commit `a44ea9d` + push (deploy automático) — rota `/api/webhooks/waha` verificada no ar
- [x] Webhook da sessão `ROMA_1` → `https://crm-roma-romadistribuicao.vercel.app/api/webhooks/waha` (eventos: `message`, `message.ack`, `session.status`) via `PUT /api/sessions/ROMA_1` — sessão `WORKING` preservada (login não caiu)
- [x] Replay das fixtures em produção: 1º envio → `created` (atendimento + mensagem reais) e 2º → `dedup_skipped`; dados de teste apagados depois
- [ ] **E2E com conversas reais** (roteiro entregue no chat): texto e mídia nos dois sentidos, áudio, progressão de ticks, transferência, modal de contatos, check de número
- [ ] Atualizar `docs/README.md`, `docs/busca-contatos-whatsapp.md`, `docs/chat-inline-redesign.md` + remover código legado após estabilização (24–48h)

**Aceite:** checklist E2E verde em produção; docs sem menção ativa à Evolution; rollback testado (reativar `EVOLUTION_*` + webhook antigo funciona).

---

## Ordem de dependência

```
F0 → F1 → F3 → F5 → F6 → F8
        ↘ F2 ↗
        ↘ F4 (com F2) → F5
                  F7 (depois de F4, independente de F5/F6)
```

F2 (infra) e F1 (testes) podem correr em paralelo. F7 é opcional e pode ir depois do cutover.

## Riscos e rollback

| Risco | Mitigação |
|---|---|
| Sessão cai / QR expira | evento `session.status` + Dashboard[6]; backup do volume `sessions`[2] |
| Ban do número | volume humano/baixo (simulado); práticas "How to Avoid Blocking"[13]; número é o mesmo de hoje — risco inalterado |
| Payload WAHA ≠ fixtures | reavivar Event Monitor e capturar payloads reais antes da Fase 4[8] |
| Mídia não baixa (`media.url: null`) | tratar `error` no objeto `media`; fallback para texto "[mídia]"[8] |
| Engine GOWS com recurso faltando | trocar engine para NOWEB/WEBJS sem mudar o código (API idêntica)[12] |
| Cutover quebra envio | rollback = religar env vars `EVOLUTION_*` + webhook `evolution` (código fica intacto até a Fase 8 fechar) |

## Definição de Pronto (projeto)

1. Nenhum import de `lib/evolution-api.ts` em código ativo.
2. Envio e recebimento de texto/mídia/áudio funcionando em produção via WAHA.
3. Testes unitários verdes (`npm test`) para `lib/waha.ts` + parser do webhook.
4. Checkmarks reais funcionando (Fase 7) ou decisão explícita de adiar.
5. Docs atualizados e `docs/pesquisa-waha-atendimento.md` + este plano linkados no `docs/README.md`.
