# CRM ROMA - Progresso do Projeto

> **Arquivo de contexto para agentes IA**
> **Última atualização:** 23/09/2026 (escopo de carteira por vendedor + rebase de base + organograma + fixes WAHA `message.any`/payload)
> **Deploy atual:** https://crm-roma-ten.vercel.app (alias: crm-roma-romadistribuicao.vercel.app — mesmo build)
> **Conta Vercel:** roma-6489 (romadistribuicao) — plano Hobby/Free
> **Conversa atual:** Migração WhatsApp Evolution API → WAHA — módulo ATENDIMENTOS (`docs/plano-implementacao-waha.md`)
>
> 📌 **Padrão de entrada para novas conversas/agentes:** ler **`PROGRESSO.MD`** (este — diário, estado e pendências) + **`docs/README.md`** (índice técnico com banner de status e links). O índice aponta o resto conforme o assunto — WhatsApp → `docs/runbook-waha-numeros.md` e `docs/HANDOFF-MIGRACAO-WAHA.md`; API/rotas → `docs/api-reference.md`; estrutura → `ARQUITETURA.md`; plano/roadmap → `docs/plano-implementacao-waha.md`. Preferências de trabalho e armadilhas: `HANDOFF` §13.

---

## 1. Visão Geral

CRM desenvolvido para a empresa ROMA (distribuidora de materiais elétricos). Sistema gerencia vendedores, clientes, vendas, produtos, atendimentos WhatsApp, campanhas e metas. Integração com ERP Millennium.

**Objetivo principal:** Centralizar a gestão comercial e atendimento ao cliente em uma plataforma única.

---

## 2. Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 14.2.28 (App Router) |
| Frontend | React 18, TypeScript, Tailwind CSS |
| UI Components | shadcn/ui (Dialog, Tabs, Card, Badge, Button, Input, ScrollArea, Select, etc.) |
| Backend | Next.js API Routes (Serverless na Vercel) |
| Banco de Dados | Supabase (PostgreSQL + Auth + Realtime) |
| Auth | Supabase Auth (JWT Bearer token) |
| Deploy | Vercel (production) — conta roma-6489 (romadistribuicao) |
| ERP Integration | Millennium ERP (NTLM auth, rede interna) |
| WhatsApp API | **WAHA (engine GOWS)** — porta 3000, sessão `ROMA_1` (substituiu a Evolution API v2.3.7 em 22/09/2026) |

---

## 3. Estrutura de Diretórios

```
crm-roma/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Rotas com layout autenticado
│   │   ├── atendimento/page.tsx  # Tela principal de atendimento (WhatsApp Web)
│   │   ├── kanban/page.tsx       # Kanban de tarefas + Banner Editável
│   │   ├── leads/page.tsx        # Fila de leads (gestor pode atribuir/reatribuir)
│   │   ├── clientes/page.tsx     # Lista de clientes (OTIMIZADA)
│   │   ├── produtos/page.tsx     # Catálogo de produtos
│   │   ├── vendas/page.tsx       # Vendas
│   │   ├── dashboard/page.tsx    # Dashboard
│   │   ├── campanhas/page.tsx    # Campanhas
│   │   ├── equipes/page.tsx      # Equipes
│   │   └── configuracoes/        # Configurações (perfil, notificações, segurança, aparência)
│   ├── api/                      # API Routes
│   │   ├── atendimentos/route.ts         # CRUD atendimentos
│   │   ├── atendimentos/mensagens/       # Chat de atendimento
│   │   ├── atendimentos/etiquetas/       # CRUD etiquetas de atendimento
│   │   ├── leads/route.ts                # CRUD leads + atribuição/reatribuição
│   │   ├── leads/distribuir/             # Distribuição automática de leads
│   │   ├── vendedores/route.ts           # Lista e cadastro de vendedores
│   │   ├── notificacoes/route.ts         # Notificações
│   │   ├── tarefas/route.ts              # Kanban tarefas
│   │   ├── produtos/route.ts             # Produtos
│   │   ├── produtos/filtros/route.ts     # Filtros de produtos (separado)
│   │   ├── clientes/route.ts             # Clientes (COM BUSCA TODOS)
│   │   ├── clientes/stats/route.ts       # Estatísticas de clientes
│   │   ├── vendas/route.ts               # Vendas
│   │   ├── oportunidades/route.ts        # Oportunidades
│   │   ├── webhooks/evolution/           # Webhook Evolution API (recebe mensagens)
│   │   └── webhooks/millennium/          # Webhook Millennium
│   ├── layout.tsx                # Layout raiz
│   └── login/page.tsx            # Tela de login
├── components/
│   ├── features/                 # Componentes por funcionalidade
│   │   ├── atendimento/          # Kanban, Chat, Lista, ListaLateral, PainelContato, FiltroEtiquetas
│   │   ├── clientes/             # Modal novo cliente, ModalDetalhesCliente
│   │   ├── configuracoes/        # Modal novo vendedor
│   │   └── vendas/               # Modal nova venda
│   ├── layout/                   # Sidebar (com logo-icon.png) — header removido em 23/09
│   ├── ui/                       # shadcn/ui components
│   └── notificacoes-bell.tsx     # Componente de notificações
├── lib/
│   ├── supabase/                 # Clientes Supabase (client.ts, server.ts)
│   ├── evolution-api.ts          # Helper para Evolution API
│   └── roteamento.ts             # Helper de roteamento de atendimentos
├── public/
│   └── logo-icon.png             # Logo do sistema no sidebar
├── docs/                         # Documentação
└── supabase/migrations/          # Migrations SQL
```

---

## 4. Funcionalidades Implementadas

### 4.1 Atendimento WhatsApp (COMPLETO — INTEGRAÇÃO EVOLUTION API)

**Tela:** `/atendimento`

**Layout WhatsApp Web:**
- **Painel esquerdo (320px):** Lista de conversas com avatar, nome, preview, telefone, hora, **badges de etiquetas**
- **Painel central (flex):** Chat inline — mensagens, input, botão enviar
- **Painel direito (320px):** Painel de contato com dados do cliente + etiquetas (selecionável)
- **Filtros:** Busca por nome/telefone, período de data, **filtro por etiqueta**
- **Polling:** Atualiza lista a cada 15s (sem loading visual)

**Etiquetas de Atendimento (FUNCIONANDO):**
- Tabela `atendimento_etiquetas` com `atendimento_id`, `etiqueta` (UNIQUE)
- API REST: GET, POST, DELETE em `/api/atendimentos/etiquetas`
- **Painel de contato:** Seção "Etiquetas" com busca + vincular/remover
- **Filtro na lista:** Dropdown "Filtrar por etiqueta" no topo da lista de conversas
- **Badges nos cards:** Cards mostram até 3 badges de etiquetas + "+N" se tiver mais
- **Atualização em tempo real:** Quando vincula/remove etiqueta, a lista e o filtro são atualizados

#### Integração Evolution API (ATIVA)

**Servidor:** VPS Hostinger KVM (Docker `john_hermes`)
**Porta:** 8082
**Versão:** 2.3.7 (Baileys)
**Instância:** ROMA_1 (número: 556234165014 — CONECTADO)

**Webhook Configurado:**
- URL: `https://crm-roma.vercel.app/api/webhooks/evolution`
- Eventos: MESSAGES_UPSERT, MESSAGES_UPDATE, CONNECTION_UPDATE

**Helper:** `lib/evolution-api.ts`

**API Evolution API:**
- **Base URL:** `http://localhost:8082`
- **Autenticação:** Header `apikey: {API_KEY}`
- **Enviar mensagem:** `POST /message/sendText/ROMA_1`
- **Body:** `{ "number": "55...", "text": "mensagem" }`

**⚠️ CUIDADOS:**
1. Usar `apikey` como header (NÃO `Authorization: Bearer`)
2. Número deve incluir código do país (55)
3. Instância deve estar conectada para enviar mensagens

#### Webhook WhatsApp (Recebimento de Mensagens)

**Endpoint:** `POST /api/webhooks/evolution`

**Fluxo:**
1. Evolution API envia payload quando cliente envia mensagem
2. Webhook extrai telefone + mensagem
3. Busca cliente pelo telefone (tolerante a formatos)
4. **Busca atendimento aberto** — busca exata primeiro, depois comparação por **últimos 8 dígitos**
5. Se encontra → atualiza atendimento + insere mensagem
6. Se não encontra → cria novo atendimento + insere mensagem

---

### 4.2 Kanban de Tarefas (COMPLETO — REFORMULADO SETEMBRO/2026)

**Tela:** `/kanban`

**3 Colunas:**
- **"A Fazer"** — Tarefas pendentes
- **"Andamento"** — Tarefas em andamento
- **"Concluído"** — Tarefas concluídas (últimos 7 dias)

**Banner Editável (NOVO — SETEMBRO/2026):**
- Banner rotativo com imagens salvas no localStorage
- Setas de navegação (aparecem ao passar o mouse)
- Botão "Editar Banner" para adicionar/remover/ordenar imagens
- Upload de imagens via file input
- Navegação automática a cada 5 segundos
- Altura: 200px (preenche bem o espaço)

**Fluxo do Modal:**

| Coluna | Botões visíveis | O que acontece |
|--------|-----------------|----------------|
| **A Fazer** | ➡️ Andamento | Só move para andamento |
| **Andamento** | ✅ Concluir | Abre modal com: Título, Descrição, Prioridade + Resultado, Observação, Valor (só se Sucesso) |
| **Concluído** | ✏️ Editar | Edita título, descrição, prioridade e valor (se Sucesso) |

**Modal de Conclusão (unificado):**
- **Título** — editável inline
- **Descrição** — textarea editável
- **Prioridade** — dropdown (Baixa, Média, Alta, Urgente)
- **Resultado*** — dropdown fixo com 5 opções:
  - ✅ Sucesso — contato/negociação realizada
  - ❌ Insucesso — não houve interesse
  - 📅 Remarcado — agendado para outro dia
  - 📞 Sem contato — não atendeu
  - 🔄 Follow-up necessário
- **Observação do resultado*** — dropdown fixo com opções por resultado
- **Valor da Venda (R$)*** — aparece APENAS quando resultado = "Sucesso"

**Drag and Drop:**
- Usando `@hello-pangea/dnd` (fork do react-beautiful-dnd)
- Arrastar para "Concluído" abre modal de conclusão (não move automaticamente)
- Arrastar para "Andamento" move direto

---

### 4.3 Clientes (COMPLETO — OTIMIZADO SETEMBRO/2026)

**Tela:** `/clientes`

**Layout Otimizado (SEM SCROLL NA PÁGINA):**
- Container preenche 100% da tela (sem scroll externo)
- Cards de estatísticas no topo (7 cards compactos)
- Lista de clientes com scroll interno (todos os clientes)
- Busca e filtros funcionais

**Cards de Estatísticas (7 cards):**
- Total de Clientes
- Ativos (30 dias)
- Inativos (60 dias)
- Recentes (61+ dias)
- Prospect
- Transfer
- Excluir

**Funcionalidades:**
- **Busca:** Nome, telefone, email (pressione ENTER)
- **Filtros:** Status (Todos, Ativo, Inativo, Bloqueado, Prospect)
- **Ordenação:** Ordem alfabética, Mais recentes, Mais antigos
- **Grid:** Visualização em grade (cards maiores)
- **Listar Todos:** Botão para carregar TODOS os clientes (com aviso de demora)
- **Modal de Detalhes:** Clique no nome → popup com informações do cliente

**Cars Compactos:**
- Cada card mostra apenas: Nome (truncado se muito grande)
- Tamanho consistente com o texto "X clientes encontrado(s)"
- Hover effect para indicar que é clicável

**Carregamento de Todos os Clientes:**
- Supabase tem limite de 1000 registros por query
- Solução: Múltiplas queries em paralelo (0-999, 1000-1999, etc.)
- Merge dos resultados no frontend
- Aviso antes de carregar: "São muitas linhas, quer continuar?"

**Modal de Detalhes do Cliente:**
- Nome completo
- Telefone
- Email
- CNPJ/CPF
- Endereço
- Status
- Vendedor responsável
- Data de criação

**Persistência de Busca:**
- Parâmetro `?q=termo` na URL
- Ao recarregar, mantém a busca
- F5 limpa a busca (volta ao estado inicial)

---

### 4.4 Leads / Fila de Leads (COMPLETO)

**Tela:** `/leads`
- Gestor pode atribuir e reatribuir leads
- Distribuição automática entre equipe
- Status: novo → em_atendimento → convertido/descartado

### 4.5 Configurações (COMPLETO)

**Tela:** `/configuracoes`
- Perfil, Notificações, Segurança, Aparência, Vendedores

### 4.6 Dashboard (COMPLETO)

**Tela:** `/dashboard`
- Performance em tempo real (metas, projeções)
- Gráficos e indicadores

### 4.7 Produtos (COMPLETO)

- Catálogo com 2195 produtos
- Paginação (50/página), busca, filtros por marca/categoria/status

### 4.8 Central de Ajuda (COMPLETO)

**Tela:** `/ajuda` — 8 abas com documentação de todas as funcionalidades

---

## 5. APIs Criadas

| Endpoint | Métodos | Descrição |
|----------|---------|-----------|
| `/api/atendimentos` | GET, POST, PATCH | CRUD + transferir + assumir + fechar |
| `/api/atendimentos/mensagens` | GET, POST | Chat de atendimento |
| `/api/atendimentos/etiquetas` | GET, POST, DELETE | CRUD etiquetas de atendimento |
| `/api/leads` | GET, PATCH | Lista leads + atribuir/reatribuir vendedor |
| `/api/leads/distribuir` | POST | Distribui leads para equipe |
| `/api/vendedores` | GET, POST | Lista todos (service_role bypass RLS) + cadastro |
| `/api/notificacoes` | GET, PATCH, DELETE | Notificações do usuário |
| `/api/tarefas` | GET, POST, PATCH, DELETE | Kanban de tarefas (inclui valor_venda) |
| `/api/produtos` | GET | Produtos paginados |
| `/api/produtos/filtros` | GET | Filtros disponíveis |
| `/api/clientes` | GET, POST | Clientes (COM BUSCA TODOS) |
| `/api/clientes/stats` | GET | Estatísticas de clientes |
| `/api/vendas` | GET, POST | Vendas |
| `/api/oportunidades` | GET, POST | Oportunidades |
| `/api/webhooks/evolution` | POST | Webhook Evolution API (recebe mensagens) |
| `/api/webhooks/millennium` | POST | Webhook do ERP |
| `/api/auth/cadastro` | POST | Cadastro de usuários |
| `/api/promocoes` | GET, POST, PATCH | CRUD promoções |
| `/api/promocoes/clientes` | GET | Clientes que compraram produto da promoção |

---

## 6. Banco de Dados (Supabase)

### 6.1 Tabelas Principais

```sql
profiles              -- Usuários/vendedores
clientes              -- Clientes (com vendedor_responsavel_id)
vendas                -- Vendas
produtos              -- Catálogo de produtos (2195 registros)
tarefas               -- Kanban (coluna_kanban: a_fazer, em_andamento, concluida)
                      -- Inclui: resultado, observacao_resultado, valor_venda
oportunidades         -- Oportunidades de vendas
atendimentos          -- Atendimentos WhatsApp
atendimento_mensagens -- Histórico de chat
atendimento_etiquetas -- Etiquetas vinculadas a atendimentos
notificacoes          -- Notificações
leads                 -- Leads B2B
presenca_vendedor     -- Status online/offline
campanhas             -- Campanhas de marketing
```

### 6.2 Colunas Importantes em `atendimentos`

- `vendedor_id` → FK para profiles (null = fila geral)
- `cliente_id` → FK para clientes
- `telefone_cliente`, `nome_cliente`
- `status`: 'aberto' | 'fechado'
- `nao_lido`: boolean
- `ultima_mensagem_remetente`: 'cliente' | 'vendedor'
- `ultima_mensagem`, `ultima_mensagem_data`
- `transbordado`: boolean

### 6.3 Colunas Importantes em `tarefas`

- `coluna_kanban`: 'a_fazer' | 'em_andamento' | 'concluida'
- `resultado`: 'sucesso' | 'insucesso' | 'remarcado' | 'sem_contato' | 'follow_up_necessario'
- `observacao_resultado`: texto livre (ou opção fixa do dropdown)
- `valor_venda`: NUMERIC(12,2) — valor da venda quando sucesso

### 6.4 Tabela `atendimento_etiquetas`

```sql
CREATE TABLE atendimento_etiquetas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atendimento_id UUID NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
  etiqueta TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(atendimento_id, etiqueta)
);
-- RLS desabilitado, GRANT para service_role e authenticated
```

### 6.5 Triggers

```sql
trg_notificar_atendimento   -- INSERT/UPDATE atendimentos → cria notificação
trg_atualizar_ultima_mensagem -- INSERT mensagem → atualiza atendimento
trg_marcar_lido             -- UPDATE atendimento → reset nao_lido quando vendedor responde
```

### 6.6 RLS (Row Level Security)

- **Tabelas com RLS ativo:** `notificacoes`, `atendimento_mensagens`, `leads`
- **Tabelas sem RLS:** `atendimento_etiquetas` (desabilitado via migration)
- API usa `service_role` para bypassar RLS quando necessário

---

## 7. Problemas Conhecidos e Soluções

| Problema | Causa | Solução |
|----------|-------|---------|
| Duplicidade de atendimentos | Busca exata por telefone (formatações diferentes) | Busca tolerante: compara últimos 8 dígitos |
| Notificações: 400+ requests/minuto | Dependência cíclica no useCallback | Trocado por useRef para IDs |
| Erro 500 ao vincular etiqueta | Tabela sem permissão GRANT | Migration 061 com GRANT ALL |
| Erro 403 ao editar tarefa | PATCH filtrava por vendedor_id | Removido filtro de vendedor no update |
| Deploy não funcionava | Token Vercel sem permissão de deploy | Integração GitHub configurada |
| Clientes não listava todos | Limite Supabase de 1000 registros | Múltiplas queries em paralelo |
| Página de clientes com scroll | Layout com altura fixa | Container flexível preenche 100% da tela |
| Banner Kanban não editável | Não existia funcionalidade | Banner rotativo com upload de imagens |

---

## 8. Otimização de Performance

### 8.1 Otimizações Implementadas

| Componente | Mudança | Impacto |
|-----------|---------|---------|
| `notificacoes-bell.tsx` | Polling 120s + useRef para evitar loop | De 400+ req/min para ~1 req/2min |
| `chat-inline.tsx` | Polling 15s | Atualização mais rápida |
| `clientes/page.tsx` | Múltiplas queries para listagem completa | Lista todos os clientes (limite Supabase) |
| `kanban/page.tsx` | Banner em localStorage | Sem queries ao banco para imagens |

### 8.2 Deploy

- **Método:** GitHub → Vercel (deploy automático)
- **Repositório:** `Johnpittz/crm-roma` (privado)
- **URL:** https://crm-roma-romadistribuicao.vercel.app
- **Conta Vercel:** roma-6489 (romadistribuicao)

### 8.3 Variáveis de Ambiente (Vercel)

| Variável | Ambiente |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | Production |
| `CNPJ_ABERTO_API_KEY` | Production |
| `EVOLUTION_API_URL` | Production |
| `EVOLUTION_API_KEY` | Production |

---

## 9. Sidebar e Logo

### 9.1 Itens Visíveis na Sidebar

```
[LOGO]                    ← logo-icon.png (sem texto)
├─ 🎧 Atendimento   Ativo
├─ 📋 Kanban
├─ 🎯 Leads
├─ 👥 Clientes
├─ 📦 Produtos
├─ 📊 Dashboard
├─ 👔 Equipes (só gestores)
├───────────────
├─ ⚙️ Configurações
├─ ❓ Ajuda
├─ 👤 Usuário [Logout]
```

### 9.2 Logo

- Arquivo: `public/logo-icon.png`
- Sidebar mostra **somente a imagem** (sem texto "CRM ROMA")

---

## 10. Decisões de Simplificação MVP

### 🔴 Funcionalidades COMENTADAS/REMOVIDAS

| Funcionalidade | Status | Para reativar |
|---|---|---|
| **Campanhas** | Comentada na sidebar | Descomentar import + navItem |
| **Oportunidades** | Comentada no atendimento | Descomentar TabsTrigger + import |
| **Vendas** | Comentada na sidebar | Descomentar import + navItem |
| **Sequências** | Removida do painel contato | Re-adicionar componente |
| **Campos Personalizados** | Removida do painel contato | Re-adicionar componente |

### 🟢 WhatsApp — Evolution API (Baileys)

**Status:** ✅ ATIVADO

**Variáveis de ambiente:**
```
EVOLUTION_API_URL=http://localhost:8082
EVOLUTION_API_KEY=e3186c32139f79c7566a1d6a3f5bc702fae199c725a313ce9b7f8ff035123b01
```

**Instância:** ROMA_1 (número: 556234165014 — CONECTADO)

**Webhook:** `https://crm-roma.vercel.app/api/webhooks/evolution`

---

## 11. Convenções de Código

### 11.1 Padrões
- TypeScript em todos os arquivos
- Componentes React: `PascalCase.tsx`
- APIs: `route.ts` (Next.js App Router)
- Hooks custom: `use[Nome].ts`
- Variáveis: `camelCase`
- Constantes: `SCREAMING_SNAKE_CASE`

### 11.2 Supabase
- **Client-side:** `createClient()` do `@/lib/supabase/client` (respeita RLS)
- **Server-side API:** `createClient()` do `@/lib/supabase/server` (respeita RLS)
- **Service Role:** `createServiceClient(url, key)` do `@supabase/supabase-js` (bypass RLS)

### 11.3 Autenticação nas APIs
- Todas as APIs validam token JWT: `Authorization: Bearer ***

### 11.4 Deploy
- **Método:** Push para GitHub → Vercel deploy automático
- **Branch:** `master`

---

## 12. Contexto Importante para Próximo Agente

### 12.1 Ambiente
- **Supabase project:** `otmkukicneotcpkemvcq`
- **VPS:** Hostinger KVM (Docker `john_hermes`) — Evolution API + Hermes Agent
- **Evolution API:** Porta 8082, versão 2.3.7 (Baileys)
- **Instâncias WhatsApp:**
  - `ROMA_1` — 556234165014 (CONECTADO ✅) — CRM-ROMA
  - `STK` — 556299190117 (desconectada)
  - `minha-conexao` — removida
- **Security headers:** via `middleware.ts`
- **Rate limiting:** 5/min (cadastro), 30/min (prospecção), 20/min (atendimentos), 60/min (webhooks)

### 12.2 Atendimento — Regras de Negócio
- **Duplicidade:** Busca tolerante por últimos 8 dígitos do telefone
- **Não existe `data_fechamento`** — usa `ultima_mensagem_data`
- **Não existe `vendedor_interagiu`** — usa `ultima_mensagem_remetente === "vendedor"`

### 12.3 Kanban — Regras de Negócio
- **A Fazer → Andamento:** Só move (botão direto)
- **Andamento → Concluído:** Modal unificado com edição + resultado + observação + valor
- **Concluído:** Só permite edição (título, desc, prioridade, valor se sucesso)
- **Campo valor:** Aparece APENAS quando resultado = "sucesso"
- **Banner:** Salvo em localStorage, editável pelo usuário

### 12.4 Clientes — Regras de Negócio
- **Busca:** Pressione ENTER para buscar (não busca automaticamente)
- **Filtros:** Status (Todos, Ativo, Inativo, Bloqueado, Prospect)
- **Listar Todos:** Botão carrega TODOS os clientes (múltiplas queries Supabase)
- **Modal de Detalhes:** Clique no nome para ver informações completas
- **Persistência:** Busca salva na URL (?q=termo)

### 12.5 Dados de Produção (atualizado 23/09/2026)
- **Vendedores ativos:** equipe GERENTE (ex-Murilo: Raquel, Valdean, Christyan, Ellen, Dara), equipe Jackson (Brennda) + **João Pedro (`diretor` — cargo trocado de `vendedor` em 23/09, estava com carteira zerada)** + Demonstração
- **Desativados (ativo=false):** Gabriel, Keila, djfhsujdhfjsdhf (ecommerce@)
- **Cargos:** vendedor, gerente_comercial, diretor, admin, demonstracao
- **Clientes:** 3.073 (rebase 23/09 via `scripts/rebase-base-clientes.js` a partir de `base_clientes/*.xls`)
- **Produtos:** 2195 produtos

---

## 13. Como Continuar

1. **Verificar migration necessária:** Adicionar colunas/tabelas em `supabase/migrations/`
2. **Criar/atualizar API:** Adicionar endpoint em `app/api/`
3. **Criar/atualizar componente:** Adicionar em `components/features/`
4. **Atualizar página:** Modificar `page.tsx` correspondente
5. **Testar local:** `npm run dev`
6. **Deploy:** `git push origin master` (deploy automático via Vercel)

**Sempre verifique o console do navegador (F12) para erros de API.**

---

## 14. Histórico de Commits Importantes

### 30/09/2026 (Top 20 CLIENTES + dropdown fixo no Criar Tarefa)
- [x] **Card do atendimento deixou de ser "Top 20 vendedores (mock)"** (`painel-inferior.tsx`): agora é **TOP 20 CLIENTES — os que mais compraram**, vindo de `GET /api/clientes/top` (novo, `app/api/clientes/top/route.ts`), ranking por **valor total comprado** com desempate por nº de pedidos, **dentro do escopo de carteira** do logado (mesma régua `lib/carteira.ts`)
- [x] **REGRA:** quem aparece no Top 20 **não aparece na listagem CLIENTES** ao lado — o card chama `GET /api/clientes?excluir_top20=1` e o corte é feito **no servidor** (lista **e** contador, e vale também na busca por nome/CNPJ). Resposta ganhou `excluidos_top20`
- [x] **`lib/top-clientes.ts`**: agrega `vendas` por `cliente_id` (paginação 1000/teto 20 mil linhas, join `clientes!inner(vendedor_responsavel_id)` para respeitar o escopo, descarta `status = cancelada`, `valor_final ?? valor_total`), cache em memória por escopo (ver o bug de cache logo abaixo). Funções puras testadas em `lib/top-clientes.test.ts`
- [x] **Estado vazio honesto:** a tabela `vendas` está **zerada em produção** (0 linhas; `oportunidades` também) — o card mostra "Sem histórico de vendas ainda — o ranking aparece quando as compras forem sincronizadas", **sem dado fictício**. Enquanto não houver vendas, o corte do Top 20 é de 0 clientes (nada some da listagem)
- [x] **CRIAR TAREFA sem input livre:** Título virou **dropdown fixo** com `ENTRAR EM CONTATO` / `MANDAR ORÇAMENTO` / `FINANCEIRO` (placeholder "Selecione a ação…", botão fica desabilitado até escolher) — no painel de contato (`painel-contato.tsx`) e também no modal "Nova Tarefa" do kanban (`nova-tarefa-modal.tsx`), que usa os mesmos Radix `Select`
- [x] **Ranking passa a ser alimentado pelo TAREFAS/KANBAN** (2ª fonte em `lib/top-clientes.ts`): `tarefas` com `resultado=sucesso` + `valor_venda > 0` somam no mesmo ranking que `vendas` — mesma régua do `/api/tarefas/resumo`. Tarefa sem `cliente_id` entra por `cliente_nome`; o servidor casa esse nome com a base (`ilike` exato, sem curinga) e, achando o cliente, **funde as duas contas no id real** (`aplicarResolucaoDeNomes`). Semântica: `chaveDoCliente(id, nome)` → id quando existe, `nome:<normalizado>` na falta
- [x] **Cadastro automático de cliente** (`POST /api/tarefas`): tarefa sem cliente vinculado → casa pelo nome; não achando, cadastra um cliente novo com o que veio do **WhatsApp** (nome + telefone, `tipo` palpite pf/pj por `lib/nome-cliente.ts`, `status=ativo`, carteira de quem criou — payload no mesmo formato do `/api/clientes`, que já é caminho de produção). Falha no cadastro **não derruba** a tarefa: ela é criada e o ranking trata o nome solto como "sem cadastro". `painel-contato` passou a enviar `telefone` junto do `cliente_nome`
- [x] Item que continua sem cadastro aparece no ranking com id sintético `sem-cadastro:<nome>` e **nunca vai para o filtro de exclusão** — `idsReaisParaExcluir()` só manda uuid para o `.not("id","in",...)` (id que não existe no banco não tiraria ninguém da lista)
- [x] Dropdown do Criar Tarefa ganhou a 4ª opção **ESTOQUE** (painel de contato + modal "Nova Tarefa" do kanban)
- [x] TDD RED→GREEN: `lib/top-clientes.test.ts` (3+9), `lib/nome-cliente.test.ts` (5), `painel-inferior.test.tsx` (+5, mock roteia `/api/clientes/top` e valida `excluir_top20=1`), `painel-contato.test.tsx` (2, valida as 4 opções e o `telefone` no POST) + 2 de regressão do cache — suíte **134/134**, `tsc --noEmit` e `next build` limpos
- [x] **Verificação em produção (leitura):** com as 2 vendas do kanban, o ranking devolve `E-commerce (sem-cadastro, R$ 1.000)` + `03.064.950 EDGAR PEREIRA DO NASCIMENTO` (nome casou com o cliente `e4804261…`); contagem do card CLIENTES **3.073 → 3.072** com o corte aplicado
- [x] **BUG REPORTADO E CORRIGIDO no mesmo dia — card apagado no kanban continuava no Top 20** (e continuava cortado da listagem CLIENTES): o ranking ficava **2 min** em cache e cada função serverless tem o seu Map. Agora o cache é em **duas camadas**: ranking **5 s** (só coalesce a rajada de requests — apagar/criar card reflete em segundos) e varredura de `vendas` **5 min** (única fonte cara de varrer). Regressão em `lib/top-clientes.test.ts` com PostgREST falso + timers falso: apagou o card → o Top 20 zera e a varredura de `vendas` não se repete. Conferência em produção: com o card apagado, o ranking calulado ao vivo já saía com 1 item e **0 exclusões** (o visto pelo usuário era o cache)
- [x] **Resolução de nome em lote:** os nomes sem cadastro casam com a base numa única consulta `in.(...)` (fallback 1 a 1 por `ilike` só para o que não veio — nome com vírgula/aspas ou caixa diferente) — antes eram até 30 queries por cálculo
- [x] **Card do kanban ganhou prévia rica** (o card tinha muito espaço vazio): o corpo inteiro saiu do
  `kanban-tarefas.tsx` para o componente puro **`components/features/atendimento/preview-tarefa.tsx`**
  (`PreviewTarefa` — junto ficaram `iconesTarefa`/`coresPrioridade`/`origemConfig` e o tipo
  `TarefaKanban`; o `Draggable` ficou onde estava). Além de prioridade/título/origem/cliente, a prévia
  mostra agora: telefone do cliente formatado no padrão BR (formato que não bate volta como está, sem
  inventar), **data · hora**, **valor da venda** em verde (`Intl` pt-BR, U+00A0 normalizado para espaço),
  **descrição** (`line-clamp-2`, não estoura o card) e **badge de resultado + observação** — cada linha
  só renderiza se o campo existir (campo vazio nunca vira linha vazia)
- [x] TDD: novo `components/features/atendimento/preview-tarefa.test.tsx` (7 testes: mantém o essencial,
  linha completa, descrição em 2 linhas, **caso vazio sem linha vazia**, 2 formatações de telefone,
  excluir devolvendo o id) — suíte **141/141**, `tsc --noEmit` e `next build` limpos
- [ ] Pendência de dados: quando o histórico do Millennium entrar em `vendas`, as duas fontes somam sozinhas (scripts em `scripts/sync-millennium*`, credenciais não estão no repo)

### 01/10/2026 (5) — Telefone do WhatsApp aparece no modal mesmo sem telefone no cadastro
- [x] **Sintoma:** clicar em `E-commerce` no Top 20 abria o modal **sem telefone** — mas a conversa no
  WhatsApp tem número (`atendimentos.telefone_cliente = 556234165003`, conversa "E-commerce" de 30/09).
- [x] **Causa:** a tarefa foi criada 30/09 **19:31**, 51 min **antes** do auto-cadastro entrar em
  produção (20:22) → o número que o formulário enviava foi descartado e nenhum cliente nasceu.
- [x] **Correção (sem dado inventado):** `ModalDetalhesCliente` — cadastro **sem telefone** ⇒ procura a
  conversa de WhatsApp com o **MESMO nome** (a mesma regra de ligação que o painel de contato já usa em
  `GET /api/tarefas?cliente_nome=`), `.ilike(nome_cliente)`, 20 últimas. **Só exibe quando todas as
  conversas com esse nome apontam para UM número só** — dois números divergentes ⇒ não mostra nada.
- [x] O número vindo da conversa aparece como **"Telefone · WhatsApp"** e alimenta também o botão
  "Abrir conversa no WhatsApp" (`telefoneInternacional`). Cadastro com telefone ⇒ nenhuma consulta.
- [x] Verificado nos dados reais: `E-commerce` → 1 conversa → **MOSTRA**; `Cliente` → 13 conversas /
  13 números → **NÃO mostra**; nome sem conversa → nada.
- [x] TDD: `components/features/clientes/modal-detalhes-cliente.test.tsx` (4 casos: mostra, ambiguo
  não mostra, cadastro com telefone não consulta, sem conversa não inventa) → **181/181**, `tsc` e
  `next build` limpos.

### 01/10/2026 (4) — Linha do TOP 20 ficou clicável (mesmo modal da direita)
- [x] **Pedido do João:** clicar numa linha do Top 20 abre o **mesmo `ModalDetalhesCliente`** que as
  linhas da listagem CLIENTES abrem (nome, status/tipo, CPF/CNPJ, telefone, e-mail, cidade, botão de
  conversa — reaproveita o `onAbrirConversa` do painel).
- [x] Para isso o ranking passou a **entregar o cliente junto**: `TopCliente.cliente` (uuid) com
  `telefone, email, cidade, estado, status, tipo` — o select de clientes do ranking foi alargado
  (`lib/top-clientes.ts`). Item `sem-cadastro:` vem com `cliente: null` e o modal abre montado com o
  nome + tipo deduzido do nome (`tipoClientePeloNome`), sem telefone.
- [x] Linha do card virou `<button>` (`w-full text-left`, `hover:bg-slate-50`) com `title="Ver detalhes
  do cliente"`; o modal fica em `painel-inferior.tsx` e fecha zerando o estado.
- [x] TDD: +2 em `lib/top-clientes.test.ts` (cliente vem com telefone/status; sem cadastro = `null`) e
  +2 no `painel-inferior.test.tsx` (clicar abre o dialog com CPF e telefone; item sem cadastro abre com
  nome) — suíte **177/177**, `tsc --noEmit` e `next build` limpos.

### 01/10/2026 (3) — Pré-cadastro do cliente ao FECHAR tarefa (+ diagnóstico do dashboard)
- [x] **Pedido do João:** fechar tarefa de cliente que não existe na base => criar o cliente automático
  ("pré-criado" com as info do WhatsApp, resto preenchido depois). Hoje só o `POST /api/tarefas` já fazia
  isso (desde o deploy **30/09 20:22**) — a tarefa do E-commerce foi criada **30/09 19:31, 51 min antes**,
  por isso ficou com `cliente_id = null`.
- [x] **`PATCH /api/tarefas` agora casa/cria o cliente** antes de gravar: se a tarefa não tem `cliente_id`
  e tem nome, casa por nome (`ilike` exato) e, não achando, insere o pré-cadastro (nome + telefone do
  WhatsApp + `vendedor_responsavel_id` = vendedor da tarefa, `status ativo`). Vale para concluir **e para
  qualquer edição** (auto-cura de tarefa antiga); falha de cadastro **nunca bloqueia** a conclusão.
  `telefone` passou a ser aceito no corpo — manda o **painel de contato** (número da conversa) e o
  **modal de conclusão do kanban** (vem do join `clientes.telefone/celular`).
- [x] **Diagnóstico (não era bug de cliente):** o card de métricas do atendimento é **do mês corrente**
  (`/api/tarefas/resumo?periodo=mes` filtra `created_at`). Venda do E-commerce: **30/09 → conta em
  SETEMBRO**; EDGAR: 01/10 → conta em OUTUBRO. Números medidos na produção: **set = R$ 1.000 ·
  out = R$ 1.000 · sem filtro de mês (Top 20) = R$ 2.000**. Ou seja: em 30/09 o card mostrava 1.000, hoje
  mostra 1.000 (outubro) — as duas vendas existem, só caem em meses diferentes.
- [x] TDD: novo `app/api/tarefas/route.patch.test.ts` (4 testes, rota real + Supabase falso: cria e vincula,
  casa sem duplicar, já vinculada não mexe, falha de cadastro não bloqueia) — suíte **173/173**,
  `tsc --noEmit` e `next build` limpos.

### 01/10/2026 (2) — Card TOP 20 e corte da listagem passam a vir da MESMA resposta
- [x] **BUG relatado pelo João:** cliente com tarefa concluída (R$ 1.000) sumiu dos **DOIS lados** — nem
  na listagem CLIENTES nem no card TOP 20. Reproduzido com os dados da produção: a listagem excluía ele
  (badge 1927 = 1928 − 1, ou seja o cálculo do Top 20 **tinha** ele) enquanto o card vinha de **outra
  chamada** (`GET /api/clientes/top`) com o **cache de 5 s de outra instância**, ainda do instante
  anterior à venda (só depois de concluir a tarefa entram `resultado`/`valor_venda`). Duas respostas
  diferentes no mesmo instante => o cliente não estava em lugar nenhum.
- [x] **Correção: uma resposta só alimenta os dois.** `GET /api/clientes` calcula o ranking **uma vez**,
  usa ele no corte (`idsReaisParaExcluir`) e devolve em **`top`**; o card (`painel-inferior.tsx`) passa a
  renderizar de lá. `GET /api/clientes/top` continua existindo só como **fallback** (resposta sem `top`
  ou falha da listagem). Card e corte agora são atomicamente iguais — no pior caso os dois estão até 5 s
  defasados **juntos** (o cliente continua na lista até o Top 20 atualizar; ele nunca some dos dois).
- [x] TDD RED→GREEN: novo `app/api/clientes/route.test.ts` (3 testes: PostgREST falso + rota de verdade —
  `top` vem junto de quem foi cortado, caminho antigo sem `contato`, e sem `excluir_top20` não calcula)
  + 3 no `painel-inferior.test.tsx` (card sem chamada separada, renderiza o `top` da resposta, fallback)
  — suíte **169/169**, `tsc --noEmit` e `next build` limpos

### 01/10/2026 — Listagem CLIENTES: prioridade de CONTATO (atrasados vermelho / realizados verde)

- [x] **Regra combinada com o João** (confirmou as 4 definições): quem tem **tarefa aberta em dia DESCE para
  o fim da lista** ("para o vendedor não se perder"), **ATRASADO = tarefa aberta há mais de 24h OU prazo
  vencido** (qualquer dos dois), **REALIZADO = tarefa concluída de qualquer data**, e no modo TODOS as
  linhas **continuam coloridas**. Ordem final: **atrasados → sem tarefa → com tarefa em dia → realizados**;
  precedência: tarefa ABERTA vence o histórico concluído (pendência nunca aparece como "feito").
- [x] Tudo em **`lib/situacao-contato.ts`** (puro: `situacaoDaTarefa`, `situacoesPorCliente`,
  `ordenarPorContato`, `aplicarFiltroContato`, `situacoesDoEscopo`). Prazo = `data_fim` (cai para
  `data_inicio`) + hora quando tem, sem hora vence 23:59; tarefa sem `cliente_id` casa pelo nome normalizado
  (`lib/nome-cliente`); leitura das tarefas respeita **a mesma carteira da listagem** (`vendedor_id` do
  vendedor/equipe — lib/carteira.ts). Falha de banco => mapa vazio e a lista continua alfabética (nunca
  derruba o card).
- [x] **`GET /api/clientes?contato=todos|atrasados|realizados`** (só o card do atendimento manda; a página
  `/clientes` não manda e continua idêntica): pega ids+nomes de todo o escopo, monta a prioridade em memória
  (o PostgREST não ordena por tarefa), corta o lote da página e traz as linhas completas **em lotes de 100**
  (URL não estoura). Devolve `contato` por linha + `contatos: {todos, atrasados, realizados}` para os chips.
- [x] **Card CLIENTES ganhou os 3 chips** no header (`Todos` · `Atrasados` · `Realizados`, com a contagem de
  cada grupo) e as linhas pintam **vermelho** (`text-red-600`) / **verde** (`text-emerald-600`) via
  `contatoPorId` no `ClientList` (prop opcional — `/clientes` continua neutro).
- [x] TDD: novo `lib/situacao-contato.test.ts` (19 testes: regra das 24h, prazo com hora, precedência,
  ordenação, filtro+contagem, escopo de carteira com PostgREST falso, erro de banco) + 4 testes no
  `painel-inferior.test.tsx` (chips, `contato=` na URL, linha vermelha/verde, caso neutro) — suíte
  **164/164**, `tsc --noEmit` e `next build` limpos

### 23/09/2026 (Escopo de carteira: vendedor só vê os próprios clientes)
- [x] **Regra aplicada nos 5 pontos que leem a base de clientes** (página `/clientes`, `GET /api/clientes`, card CLIENTES do atendimento, dropdown da Nova Venda, `GET /api/promocoes/clientes`): `vendedor` → só `vendedor_responsavel_id = ele`; `gerente_comercial`/`diretor`/`admin` → carteira toda (**visão provisória**, troca quando isso sumir do produto); `demonstracao` → própria, mesmo vazia (a sidebar já oculta `/clientes` para demo: "não deve ver clientes reais")
- [x] Régua única **`lib/carteira.ts`** (`escopoCarteira(cargo)`, `ehGestor(cargo)`, `aplicarEscopoClientes(query, escopo, userId)`) — TDD RED→GREEN com `lib/carteira.test.ts` (13 testes), suíte **83/83**, `tsc --noEmit` e `next build` limpos
- [x] `GET /api/clientes` deixou de devolver `clientes: []` + total global via service role: agora valida o token, lê o **cargo no servidor**, aplica o escopo e devolve `{ clientes, total, escopo, limite }` (query `limite` padrão 200/máx 1000, `busca`, `status`)
- [x] Página `/clientes`: os 5 cards de estatística, a busca, o "Mostrar todos" e a listagem contam só o escopo do logado (leitura via service role **com escopo aplicado no servidor** — a RLS de `clientes` não está versionada no repo, então não dá pra depender dela)
- [x] Card **CLIENTES** do atendimento (`painel-inferior.tsx`): `CLIENTES_MOCK` + badge "dados de exemplo" removidos — reusa o mesmo `ClientList` da página de clientes, com contador da carteira, estado vazio e aviso quando a lista vem truncada (**Top 20 continua mock**)
- [x] **Dados de produção:** único vendedor ativo com carteira zerada era **João Pedro (0 de 3.073)** → cargo alterado para `diretor` (vê tudo). Verificação pós-alteração: **nenhum vendedor ativo zerado**; soma das carteiras = 2.673 (vendedores) + 400 (Jackson, gestor com carteira própria) = 3.073
- [x] **CORREÇÃO no mesmo dia — a carteira é dividida ENTRE OS GESTORES:** `gerente_comercial` saiu de "ver tudo" para **`equipe`** (vendedores com `gestor_id` dele + carteira própria). Produção: GERENTE **1.928** (Christyan 563, Dara 630, Raquel 588, Valdean 124, Ellen 23) + Jackson **1.145** (Brennda 745 + 400 dele) = **3.073**, batendo com o card "Clientes na Carteira" de `/equipes`. `diretor`/`admin` (direção) mantêm visão total. Escopo `equipe` resolve os ids com `idsDaEquipe()` (falha => só a dele, fail-closed) e filtra com `.in(...)`; `pertenceAoEscopo()` faz a mesma checagem em memória nas Campanhas. Testes: **87/87**
- [ ] Pendência alinhada: **vendas, atendimentos, tarefas e oportunidades ainda dão ao gestor visão GLOBAL da empresa** (`isGestor` sem filtro de equipe). Se a regra "carteira dividida entre os gestores" vale também para eles, quem resolve é a mesma régua (`lib/carteira.ts`) — decidir antes de mexer
- [ ] Pendência: **não existe transferência de carteira** (`PATCH /api/clientes/[id]` inexistente; card "Transfer" hardcoded em `0`) — atribuição errada não tem como corrigir pela UI
- [x] **Header superior removido (todas as telas):** `app/(dashboard)/layout.tsx` deixou de renderizar `<Header />` e `components/layout/header.tsx` foi apagado — título/subtítulo da rota, pílula de data, botão de busca (não tinha `onClick`) e atalho de Ajuda (segue na sidebar). O conteúdo sobe e devolve ~56px, priorizando a área de chat do Atendimento. **`NotificacoesBell` não foi apagado:** era dele o polling + toast + som — ganhou prop `className` e ícone `text-current` e foi para o **topo da sidebar** (dropdown abre para baixo, sem cortar em telas baixas). TDD: `components/notificacoes-bell.test.tsx` (3) — suíte **101/101**.
- [ ] Pendência conhecida (não mexida): `GET /api/atendimentos/mensagens` não checa dono (service role nos dois lados, legado do BUG-7) e `POST /api/promocoes` tem `isGestor = true` hardcoded
- [x] **Filtro no card CLIENTES — vendedor não sai da tela:** os dois cards da faixa inferior passaram de 165px para **230px**; o card CLIENTES agora busca sozinho em `GET /api/clientes` e repete a busca com **debounce de 300ms**. `busca` passou a varrer **nome, CPF/CNPJ, telefone, celular e e-mail** (`lib/busca-clientes.ts`: sanitiza vírgula/parênteses e curinga do LIKE antes de virar `.or()` do PostgREST) — mesma busca também na página `/clientes`. Estados: `buscando…`, `mostrando N de TOTAL` (só sem termo) e `Nenhum cliente encontrado para "X"`. TDD: `lib/busca-clientes.test.ts` (7) + `components/features/atendimento/painel-inferior.test.tsx` (4, jsdom com `fetch` mockado, cobrindo debounce e ausência de `busca=` na carga inicial) — suíte **98/98**; `vitest.config.ts` ganhou o alias `@/` (antes não dava pra testar componente que importa `@/components/...`). `atendimento/page.tsx` deixou de buscar clientes: o card é auto-suficiente

### 23/09/2026
- [x] Fix mídia recebida (BUG-5 — URL `localhost` do WAHA): `resolverUrlMidia()` (normalização + fallback por histórico) plugada no `processarMidia()` do webhook — commit `b880ea2` (TDD: 5 testes novos)
- [x] Lightbox de imagem: clique expande dentro do CRM (fecha com clique/Esc), sem aba nova — `components/features/atendimento/lightbox.tsx`, commit `33bfcbc` (5 testes jsdom)
- [x] Legenda `[image]` duplicada corrigida (`ehPlaceholderConteudo` em `lib/waha-webhook.ts`, 2 testes)
- [x] `vitest.config.ts` (transform de JSX nos testes) + devDeps jsdom/@testing-library — suíte em **61/61 verdes** + tsc limpo
- [x] `docs/HANDOFF-MIGRACAO-WAHA.md` atualizado (estado, bugs resolvidos, pendências)
- [x] Bug do envio do CRM (**500 RLS — BUG-7**): POST `/api/atendimentos/mensagens` passou a escrever via service role (a policy só deixava o vendedor dono do atendimento escrever; quebrou quando o roteamento atribuiu `vendedor_id`) — commit `1fe771d`, verificado RED→GREEN com `scripts/smoke-envio-mensagens.sh` + entrega real no WhatsApp
- [x] Toast de erro no envio de mensagem (falha não fica mais em silêncio no cliente)
- [x] Busca de contatos ("Novo Contato"): nomes apareciam todos "Sem nome" e alguns com `@c.us` cru — payload real do GOWS usa `pushname` minúsculo + JID `@c.us`; helper única `extrairTelefoneJid` (`lib/telefone.ts`) no modal e na seleção (também evitava criar atendimento com JID de grupo/@lid como telefone)
- [x] Validação E2E: imagem nova recebida aparece no chat + lightbox no navegador (confirmado pelo usuário)
- [x] **LIBERADO PARA USO PELA EQUIPE** (23/09/2026): texto e mídia (vídeo, áudio, documento) enviando e recebendo — validado pelo usuário
- [ ] Varredura de mídia (vídeo/sticker **recebidos** ainda não testados ao vivo — conferir organicamente no uso)

### 23/09/2026 (Rebase da base de clientes + organograma)
- [x] **Base de clientes refeita do zero:** 1.739 clientes antigos apagados (com backup JSON) e substituídos pelos **3.073 clientes únicos** das 7 planilhas de `base_clientes/*.xls` (exportação Millennium "Parceiro", 3.080 linhas brutas − 7 duplicações de `cpf_cnpj`: 4 internas + 3 entre planilhas — o banco tem UNIQUE em `cpf_cnpj`)
- [x] Script `scripts/rebase-base-clientes.js` (fases `backup|wipe|perfis|import|verify`, retomável/idempotente): importador novo com dedupe por `codigo_erp` + `cpf_cnpj`, bisecção para isolar linhas rejeitadas, mapeamento planilha→vendedor, enum `tipo_pessoa` = `pf`/`pj`, CEP = coluna 27 (o importador antigo lia a 26 por engano)
- [x] Backup pré-limpeza: `backups/rebase-2026-09-23/` (profiles, clientes, vendas, venda_itens, atendimentos, atendimento_mensagens, atendimento_etiquetas, leads, tarefas, oportunidades + `import-summary.json`)
- [x] Limpeza de dependentes de teste na ordem correta (FK `leads.cliente_id → clientes` sem ON DELETE): tarefas, leads, venda_itens, vendas, atendimentos (mensagens/etiquetas em CASCADE), clientes
- [x] **Organograma novo:** Jackson **promovido a `gerente_comercial`** (gestor de si mesmo, carteira própria JACKSON.xls = 400) com equipe: **Brennda**; Murilo (`gerente_comercial`) com equipe: **Raquel, Valdean, Christyan, Ellen, Dara** (Valdean antes sem gestor → Murilo)
- [x] Novos vendedores criados no auth: **Ellen** (ellen@romagyn.com.br) e **Dara** (dara@romagyn.com.br), senha temporária padrão, `gestor_id` → Murilo
- [x] Desativados (`ativo=false`): **Gabriel** (saiu da gestão), **Keila** (fora do novo organograma), **djfhsujdhfjsdhf** (perfil de teste ecommerce@)
- [x] Verificação final: total 3.073 ✅, soma por vendedor bate ✅, organograma impresso ✅
- ⚠️ Pendências: `ativo=false` **não bloqueia login** hoje (não há checagem no login) — se quiser, criar essa checagem + filtro `ativo` nas listagens; Valdean usa domínio `romadistribuicao` (diferente dos demais da equipe Murilo que são `romagyn`)
- [x] **Conta "Murilo" renomeada para "GERENTE"** (a pessoa saiu): mesma conta (`gestorcomercial@romagyn.com.br`), cargo `gerente_comercial` e equipe intacta (Christyan, Dara, Ellen, Raquel, Valdean) — só mudou o `nome_completo`

### 23/09/2026 (Bugfix: mensagens enviadas do celular não apareciam no CRM)
- **Sintoma 1:** mensagens recebidas chegam; as que o vendedor manda direto no WhatsApp (celular) não atualizavam o chat do CRM.
- **Causa raiz 1:** a sessão `ROMA_1` só assinava o evento `message`, que o WAHA dispara **apenas para recebidas**. Faltava `message.any` (cobre enviadas e recebidas — confirmado na issue oficial devlikeapro/waha#1689).
- **Correção 1 (config, sem deploy):** `PUT /api/sessions/ROMA_1` → `events: ["message.any","message.ack","session.status"]`; sessão reiniciou `STARTING → WORKING` **sem novo QR** (runbook §4). Verificado por GET na API.
- **Sintoma 2 (após correção 1):** mensagem de GRUPO aparecia no CRM como conversa "Cliente 556234165014" (o próprio número do bot!).
- **Causa raiz 2:** parser `lib/waha-webhook.ts` fazia `fromMe ? to : from` — mas no payload WAHA **`to` é sempre o próprio usuário e `from` é o chat** (prova: recebida real `to=556234165014`; enviada no grupo também `to=556234165014`). Resultado: telefone = eu mesmo, `grupo` = false → o guard "Ignorar mensagens de GRUPO" (que já existia na rota, linhas 189-193) **nunca disparava**.
- **Correção 2 (código):** `rawFrom = payload.from || payload.to` (chat sempre). RED→GREEN com 2 testes novos.
- **Limpeza:** atendimento lixo `Cliente 556234165014` (f42e2298, 2 mensagens de teste, criado 12:04 local) apagado.
- **Código (hardening):** resposta do **AI Sales** agora grava `whatsapp_message_id` no insert — sem isso o eco do `message.any` duplicaria a linha da IA (o envio manual do vendedor já gravava, dedup OK). AI Sales continua gateado por `remetente === "cliente"` → não dispara com mensagem nossa.
- **Testes:** +3 casos em `lib/waha-webhook.test.ts` (fromMe usa `from`; grupo enviado → `grupo:true`; `message.any` recebido = `message`) — suíte **70/70**.
- **Docs:** `runbook-waha-numeros.md` §4 atualizado com os alertas (`message.any` + regra `from`/`to`).
- ⚠️ Risco monitorado: issues GOWS do WAHA (#2250/#2255, 09/2026) relatam webhook de `message.any` eventualmente não entregue em algumas versões — se privadas continuarem caindo, conferir `docker logs waha` (host) e atualizar a imagem.
- **Validação pós-deploy (`c2b460f`):** envio PRIVADO via API (`source:api`) → `message.any` entregue e processado ✅ (o teste anterior, sob o parser antigo, foi rejeitado — payload privado não tinha `to` utilizável; parser novo usa `from`). **Envio privado do CELULAR (`source:app`) pendente de teste real com o João.**
- ⚠️ **Replay de sessão duplica linha:** no restore do webhook, o GOWS re-emitiu a mesma mensagem com id em forma **lid** (`true_190126021943368@lid_…` ≠ `true_556234165014@c.us_…`) → dedup por id não pegou. Pendência: dedup por conteúdo+ janela de N minutos para `from_me`, ou imunizar em restarts.
- 🧪 Capturador local (2º webhook em `172.16.1.2:9099`) **não recebeu nada** — isolamento de rede entre containers Docker do host; webhooks só funcionam por URL pública. Config restaurada (1 webhook), listener encerrado.

### 22/09/2026
- [x] Migração WhatsApp Evolution → WAHA (módulo ATENDIMENTOS): `docs/plano-implementacao-waha.md` (9 fases) + `docs/pesquisa-waha-atendimento.md` (13 fontes)
- [x] Fase 1: fundação de testes (vitest — **34 testes**), `lib/telefone.ts` (fonte única de formatação, débito §8.5 quitado)
- [x] Fase 2: WAHA (engine GOWS) instalado na VPS, sessão `ROMA_1` conectada; runbook `docs/runbook-waha-numeros.md` + skill `waha-conectar-numero`
- [x] Fases 3–7 (TDD): `lib/waha.ts` + `lib/waha-webhook.ts`, webhook `/api/webhooks/waha` (mídia pronta via `media.url`, sem decrypt), envio/contatos migrados, `@lid` resolvido (débito §8.2), checkmarks reais (`ack_status` + `sendSeen` ao abrir conversa)
- [x] Migration `067_ack_status_mensagens.sql` aplicada no Supabase
- [ ] Fase 8 — cutover: env vars no Vercel → push/deploy → webhook `ROMA_1` → produção → E2E
- ⚠️ `lib/evolution-api.ts` + `app/api/webhooks/evolution` marcados `@deprecated` (rollback; remover após estabilização)

### 09/09/2026
- [x] **Evolution API:** Integração completa (substitui BotConversa)
- [x] **Instância ROMA_1:** Criada e conectada (número: 556282735286)
- [x] **Webhook:** Configurado para receber mensagens da Evolution API
- [x] **Kanban:** Banner editável com upload de imagens + setas de navegação
- [x] **Kanban:** Banner rotativo (5s) + hover para mostrar setas
- [x] **Clientes:** Layout otimizado (sem scroll na página)
- [x] **Clientes:** 7 cards de estatísticas (Total, Ativos, Inativos, Recentes, Prospect, Transfer, Excluir)
- [x] **Clientes:** Lista compacta (apenas nome)
- [x] **Clientes:** Busca com persistência na URL
- [x] **Clientes:** Filtros por status
- [x] **Clientes:** Ordenação (alfabética, recentes, antigos)
- [x] **Clientes:** Listar TODOS (múltiplas queries Supabase)
- [x] **Clientes:** Modal de detalhes (clique no nome)
- [x] **Clientes:** Container preenche 100% da tela
- [x] **Deploy:** Integração GitHub configurada (deploy automático)

### 28/07/2026
- [x] Roteamento de atendimentos: tabela `config_roteamento_whatsapp` + helper `lib/roteamento.ts`
- [x] Áudio WhatsApp: migration `url_audio` + parser webhook + player chat-inline
- [x] Etiquetas sincronizadas: helper `lib/etiquetas.ts` compartilhado

### 16/07/2026
- [x] Sidebar: logo-icon.png substituiu letra "R" (sem texto)
- [x] Kanban: Modal simplificado — "Concluir" unificado

### 15/07/2026
- [x] Kanban: Opções fixas de observação de resultado
- [x] Migration 062: `tarefas.valor_venda NUMERIC(12,2)`

### 14/07/2026
- [x] Correção de duplicidade de atendimentos
- [x] Correção de loop de notificações
- [x] Badges de etiquetas nos cards

---

*Documento atualizado automaticamente pelo Hermes Agent em 09/09/2026*
