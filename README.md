# CRM ROMA

Sistema de gestão comercial para vendedores físicos e diretoria.

> **Estado (23/09/2026):** em produção na Vercel + Supabase. WhatsApp via **WAHA**
> (Evolution = rollback). Organograma: contas GERENTE (5 vendedores) e Jackson
> (Brennda). Base: 3.073 clientes. Testes: `npm test` (70). Diário: `PROGRESSO.MD`.
> Documentação completa: `docs/README.md`.

## 🚀 Tecnologias

- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Recharts (gráficos)
- @hello-pangea/dnd (Kanban drag-and-drop)

## 📁 Estrutura

```
crm-roma/
├── app/
│   ├── (authenticated)/     # Rotas autenticadas
│   │   ├── atendimento/     # Tela do vendedor
│   │   ├── dashboard/       # Tela de gestão
│   │   └── layout.tsx       # Layout com sidebar
│   ├── login/               # Tela de login
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                  # Componentes shadcn/ui
│   └── features/
│       └── atendimento/     # Componentes da tela de atendimento
├── lib/
│   ├── data/
│   │   └── mock.ts          # Dados mockados
│   └── utils/
│       └── cn.ts            # Utilitário de classes
└── ...
```

## 🛠️ Instalação

```bash
# Entrar na pasta do projeto
cd crm-roma

# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev
```

Acesse: http://localhost:3000

## 📱 Telas

### Tela de Atendimento (Vendedor)
- `/atendimento` - Página principal do vendedor
- Performance em tempo real com projeção matemática
- Kanban de tarefas com drag-and-drop
- Agenda do dia
- Motor de oportunidades
- Toggle de presença (transbordo WhatsApp)
- Painel de incentivos

### Tela de Dashboard (Gestão)
- `/dashboard` - Visão gerencial (⚠️ **ainda com dados mockados**)
- Ranking de vendas
- Evolução mensal (12 meses)
- CAC por canal
- Churn analítico (com motivo obrigatório)
- Ticket médio protegido
- Mapa de calor

## 🗄️ Banco de Dados (Supabase)

- Projeto ativo em produção — migrations em `supabase/migrations/` (009–069)
- Autenticação ativa; proteção de rotas no `(dashboard)`
- WhatsApp: webhook principal `POST /api/webhooks/waha` (eventos `message.any`/`message.ack`/`session.status`)
- Rebase de dados: `node scripts/rebase-base-clientes.js <backup|wipe|perfis|import|verify>`

## 📝 Notas

- `/dashboard` e o ranking "Top 20" usam dados mockados (mantido propositalmente por enquanto)
- O restante do atendimento usa dados reais (Supabase + WAHA)
- Projeção matemática calcula tendência baseada em dias úteis
- Kanban permite arrastar tarefas entre colunas
- Testes automatizados: `npm test` (vitest, 98 testes)
