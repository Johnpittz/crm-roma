# 🏢 CRM ROMA

**Sistema de Gestão Comercial para Distribuidoras**

O CRM ROMA é uma plataforma web completa para gestão de vendas e atendimento de empresas distribuidoras. Integra WhatsApp via **WAHA** (self-hosted, engine GOWS — a Evolution API ficou só como rollback), oferece quadros Kanban para gestão do funil de vendas, controle de clientes, tarefas, leads e dashboards gerenciais em tempo real.

> **Status rápido (23/09/2026):** módulo **ATENDIMENTOS em produção** com WAHA (liberado para a equipe em 23/09) · **83 testes** (`npm test`) · **regra de carteira ativa:** vendedor só vê os próprios clientes (`lib/carteira.ts`) · organograma/base refaços hoje — ver `PROGRESSO.MD` (diário de bordo) e §12.5 (usuários atuais) · runbook de números: `runbook-waha-numeros.md` · handoff técnico: `HANDOFF-MIGRACAO-WAHA.md`.

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Stack Tecnológica](#stack-tecnológica)
- [Funcionalidades](#funcionalidades)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Instalação e Desenvolvimento](#instalação-e-desenvolvimento)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Deploy](#deploy)
- [Endpoints da API](#endpoints-da-api)

---

## Visão Geral

O CRM ROMA foi projetado para equipes comerciais de distribuidoras, oferecendo:

- **Atendimento integrado via WhatsApp** com interface estilo WhatsApp Web (3 colunas: lista, chat, painel de contato)
- **Quadros Kanban** para gestão de tarefas e funil de vendas com arrastar-e-soltar
- **Gestão completa de clientes** com cadastro, busca, filtros e estatísticas
- **Sistema de leads e prospecção** com distribuição automática
- **Dashboards gerenciais** com métricas de performance em tempo real
- **Controle de equipes** para gestores e diretores
- **Integração com IA para vendas** (AI Sales) para geração automática de oportunidades
- **Integração com sistema ERP Millennium** para dados de vendas

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| **Framework** | [Next.js 14](https://nextjs.org/) (App Router, Server Components) |
| **Frontend** | React 18, TypeScript |
| **Estilização** | [Tailwind CSS 3](https://tailwindcss.com/) |
| **Componentes UI** | [shadcn/ui](https://ui.shadcn.com/) (Radix UI) |
| **Backend/Database** | [Supabase](https://supabase.com/) (PostgreSQL, Auth, Realtime) |
| **Ícones** | Lucide React |
| **Gráficos** | Recharts |
| **DnD (Drag and Drop)** | @hello-pangea/dnd |
| **Toasts** | Sonner |
| **WhatsApp API** | [WAHA](https://waha.devlike.pro/) self-hosted (engine GOWS, sessão `ROMA_1`) — Evolution API apenas como rollback |
| **Exportação** | xlsx (planilhas Excel) |

---

## Funcionalidades

### 💬 Atendimento WhatsApp
- Interface estilo WhatsApp Web com 3 colunas
- Lista lateral de conversas com busca e filtros por etiquetas
- Chat inline com envio de mensagens e mídia
- Painel de contato com informações do cliente
- Barra de métricas de atendimento (realizado vs meta)
- Simulação de WhatsApp (para demonstração)
- Sincronização automática via polling (a cada 15s)
- Gestão de etiquetas e tarefas vinculadas a conversas
- **Busca de Contatos WhatsApp** — Modal para busca de contatos via Evolution API, com verificação de números e criação automática de atendimento
  - Componente `buscar-contatos-whatsapp.tsx` (modal de busca)
  - Endpoint `GET /api/whatsapp/contacts` — Lista contatos da instância WhatsApp
  - Endpoint `POST /api/whatsapp/check-number` — Verifica se números existem no WhatsApp
  - Integração com WAHA (`findContacts` e `contacts/check-exists` — ver `docs/busca-contatos-whatsapp.md`)

### 📋 Kanban
- **Visão Principal** (Dashboard): painel gerencial com métricas consolidadas
- **Kanban de Tarefas**: quadro com drag-and-drop para organização de tarefas
- **Kanban Funil**: visualização do funil de vendas por etapa
- Filtros por busca e período

### 👥 Gestão de Clientes
- **Escopo por carteira:** cada vendedor vê apenas os próprios clientes; `gerente_comercial`/`diretor`/`admin` veem a carteira toda (visão provisória) — régua única em `lib/carteira.ts`
- Cadastro, edição e busca de clientes
- Filtros por status (ativo, inativo, bloqueado, prospect)
- Estatísticas detalhadas (total, ativos, inativos, etc.)
- Relação com grupos econômicos
- Exportação de dados

### 🎯 Leads e Prospecção
- Pipeline de leads com distribuição automática
- Gestão de prospecção
- Integração com oportunidades

### 📊 Dashboard Gerencial
- Métricas consolidadas de performance
- Gráficos de vendas e atendimento
- KPIs em tempo real

### ⚙️ Configurações
- Gestão de vendedores
- Configurações do sistema
- Permissões por cargo (vendedor, gerente_comercial, diretor, admin, demonstracao)

---

## Estrutura do Projeto

```
crm-roma/
├── app/
│   ├── (auth)/                    # Rotas de autenticação
│   ├── (dashboard)/               # Rotas autenticadas (Dashboard)
│   │   ├── layout.tsx             # Layout do dashboard (sidebar + header)
│   │   ├── actions.ts             # Server actions (logout)
│   │   ├── atendimento/           # Página de atendimento WhatsApp
│   │   ├── kanban/                # Kanban de tarefas e funil
│   │   ├── clientes/              # Gestão de clientes
│   │   ├── leads/                 # Pipeline de leads
│   │   ├── vendas/                # Registro de vendas
│   │   ├── produtos/              # Catálogo de produtos
│   │   ├── campanhas/             # Campanhas e promoções
│   │   ├── dashboard/             # Dashboard gerencial
│   │   ├── equipes/               # Gestão de equipes
│   │   ├── configuracoes/         # Configurações do sistema
│   │   └── ajuda/                 # Central de ajuda
│   ├── api/                       # Rotas de API (Backend)
│   │   ├── atendimentos/          # CRUD de atendimentos e mensagens
│   │   │   ├── route.ts
│   │   │   ├── mensagens/route.ts
│   │   │   ├── etiquetas/route.ts
│   │   │   └── sync/route.ts
│   │   ├── whatsapp/
│   │   │   ├── contacts/route.ts  # Busca de contatos WhatsApp
│   │   │   └── check-number/route.ts # Verificação de números WhatsApp
│   │   ├── tarefas/               # CRUD de tarefas
│   │   ├── clientes/              # API de clientes
│   │   ├── leads/                 # API de leads
│   │   ├── leads/distribuir/      # Distribuição automática de leads
│   │   ├── vendas/                # API de vendas
│   │   ├── produtos/              # API de produtos
│   │   ├── promocoes/             # API de promoções
│   │   ├── vendedores/            # API de vendedores
│   │   ├── equipes/               # API de equipes
│   │   ├── oportunidades/         # API de oportunidades
│   │   ├── prospeccao/            # API de prospecção
│   │   ├── notificacoes/          # API de notificações
│   │   ├── ai-sales/              # IA para vendas
│   │   ├── webhooks/              # Webhooks externos
│   │   │   ├── waha/              # ⭐ Webhook PRINCIPAL do WhatsApp (WAHA)
│   │   │   ├── evolution/         # Webhook legado Evolution (rollback)
│   │   │   ├── whatsapp/          # Webhook WhatsApp alternativo
│   │   │   └── millennium/        # Webhook do ERP Millennium
│   │   ├── media-download/        # Download de mídia
│   │   ├── send/media/            # Envio de mídia
│   │   └── auth/cadastro/         # Cadastro de usuários
│   ├── layout.tsx                 # Layout raiz
│   └── globals.css                # Estilos globais
├── components/
│   ├── features/                  # Componentes por feature
│   │   ├── atendimento/           # Componentes de atendimento
│   │   │   ├── chat-inline.tsx    # Chat inline estilo WhatsApp
│   │   │   ├── painel-contato.tsx # Painel lateral de contato
│   │   │   ├── kanban-tarefas.tsx # Quadro Kanban de tarefas
│   │   │   ├── kanban-funil.tsx   # Kanban do funil de vendas
│   │   │   ├── dashboard-kanban.tsx # Dashboard do Kanban
│   │   │   ├── barra-metricas.tsx # Barra de métricas
│   │   │   ├── filtro-etiquetas.tsx # Filtro por etiquetas
│   │   │   ├── performance-realtime.tsx # Performance em tempo real
│   │   │   ├── motor-oportunidades.tsx # Motor de oportunidades
│   │   │   ├── painel-incentivos.tsx # Painel de incentivos
│   │   │   ├── nova-tarefa-modal.tsx # Modal de nova tarefa
│   │   │   ├── toggle-ai-sales.tsx # Toggle da IA
│   │   │   ├── toggle-presenca.tsx # Toggle de presença
│   │   │   └── buscar-contatos-whatsapp.tsx # Modal de busca de contatos WhatsApp
│   │   ├── clientes/              # Componentes de clientes
│   │   ├── campanhas/             # Componentes de campanhas
│   │   ├── configuracoes/         # Componentes de configurações
│   │   └── ajuda/                 # Conteúdos da central de ajuda
│   ├── layout/                    # Componentes de layout
│   │   ├── sidebar.tsx            # Sidebar de navegação
│   │   └── header.tsx             # Header da aplicação
│   └── ui/                        # Componentes shadcn/ui
├── lib/
│   ├── supabase/                  # Configurações do Supabase
│   │   ├── client.ts              # Cliente Supabase (browser)
│   │   ├── server.ts              # Cliente Supabase (server)
│   │   ├── admin.ts               # Cliente Supabase (admin)
│   │   ├── admin-server.ts        # Cliente admin server
│   │   └── middleware.ts          # Middleware de auth
│   ├── waha.ts                    # Adapter WAHA (envio, sessão, contatos)
│   ├── waha-webhook.ts            # Parser dos eventos do webhook WAHA
│   ├── evolution-api.ts           # Legado/rollback (substituído por waha.ts)
│   ├── integrations/
│   │   └── millennium-api.ts      # Integração ERP Millennium
│   ├── ai-sales-prompts/          # Prompts da IA
│   ├── utils/                     # Utilitários
│   └── data/mock.ts               # Dados mockados
├── public/
│   └── logo-icon.png              # Logo da aplicação
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
└── postcss.config.mjs
```

---

## Instalação e Desenvolvimento

### Pré-requisitos

- Node.js 18+
- npm ou yarn
- Conta no [Supabase](https://supabase.com/)
- WAHA self-hosted (credenciais em `.env.local` — ver `docs/runbook-waha-numeros.md`)

### Clonar e instalar

```bash
git clone https://github.com/Johnpittz/crm-roma.git
cd crm-roma
npm install
```

### Configurar variáveis de ambiente

Copie o arquivo de exemplo e configure:

```bash
cp .env.local.example .env.local
```

Edite `.env.local` com suas credenciais (veja seção [Variáveis de Ambiente](#variáveis-de-ambiente)).

### Rodar em desenvolvimento

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

### Outros comandos

```bash
npm run build    # Build de produção
npm run start    # Iniciar servidor de produção
npm run lint     # Verificar código
```

---

## Variáveis de Ambiente

As seguintes variáveis devem ser configuradas no arquivo `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

# WhatsApp — WAHA (principal)
WAHA_API_URL=http://srv1745477.hstgr.cloud:3000
WAHA_API_KEY=sua-api-key
WAHA_SESSION=ROMA_1
# Evolution API — mantida apenas como rollback
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua-api-key

# Millennium ERP (opcional)
MILLENNIUM_API_URL=https://api.millennium.com
MILLENNIUM_USER=usuario
MILLENNIUM_PASS=senha

# AI Sales
GEMINI_API_KEY=sua-gemini-key
```

---

## Deploy

### Vercel (Recomendado)

O CRM ROMA é otimizado para deploy na [Vercel](https://vercel.com/):

1. Acesse [vercel.com](https://vercel.com/) e importe o repositório
2. Configure as variáveis de ambiente no painel da Vercel
3. O deploy será feito automaticamente a cada push na branch `master`

**Repositório GitHub:** [Johnpittz/crm-roma](https://github.com/Johnpittz/crm-roma)

### Deploy Manual

```bash
npm run build
npm run start
```

---

## Endpoints da API

### Autenticação
- `POST /api/auth/cadastro` — Cadastro de novos usuários

### WhatsApp
- `GET /api/whatsapp/contacts` — Lista contatos da agenda via WAHA (`findContacts`)
- `POST /api/whatsapp/check-number` — Verifica se números existem no WhatsApp (`check-exists`)

### Atendimentos
- `GET /api/atendimentos` — Lista atendimentos
- `PATCH /api/atendimentos` — Atualiza status de atendimento
- `GET /api/atendimentos/mensagens` — Mensagens de um atendimento
- `GET /api/atendimentos/etiquetas` — Etiquetas vinculadas
- `POST /api/atendimentos/sync` — Sincronização

### Clientes
- `GET /api/clientes` — lista clientes **do escopo do logado** (`?limite=&busca=&status=`) → `{ clientes, total, escopo, limite }`
- `POST /api/clientes` — cria cliente já na carteira de quem cadastrou (demo bloqueado)

### Leads
- `GET/POST /api/leads` — CRUD de leads
- `POST /api/leads/distribuir` — Distribuição automática

### Tarefas
- `GET/POST /api/tarefas` — CRUD de tarefas
- `GET /api/tarefas/resumo` — Resumo de tarefas

### Vendas
- `GET/POST /api/vendas` — CRUD de vendas

### Produtos
- `GET/POST /api/produtos` — CRUD de produtos
- `GET /api/produtos/filtros` — Filtros de produtos

### Outros
- `GET/POST /api/vendedores` — Gestão de vendedores
- `GET/POST /api/equipes` — Gestão de equipes
- `GET/POST /api/promocoes` — Promoções e campanhas
- `GET/POST /api/oportunidades` — Oportunidades de venda
- `GET/POST /api/prospeccao` — Prospecção
- `GET/POST /api/notificacoes` — Notificações
- `GET/POST /api/ai-sales` — IA para vendas

### Webhooks
- `POST /api/webhooks/waha` — ⭐ **Principal**: eventos `message.any` / `message.ack` / `session.status` da WAHA (mensagens enviadas E recebidas; grupos ignorados; dedup por `whatsapp_message_id`)
- `POST /api/webhooks/evolution` — Legado/rollback (Evolution API)
- `POST /api/webhooks/whatsapp` — Webhook WhatsApp alternativo
- `POST /api/webhooks/millennium` — Dados do ERP Millennium

---

## Licença

Projeto privado — Empresa ROMA.

---

**Desenvolvido com ❤️ para a equipe comercial da ROMA**
