# 📁 Arquitetura do Projeto - CRM ROMA

## Estrutura de Pastas (Padrão Profissional)

```
crm-roma/
├── app/
│   ├── (auth)/                    # Rotas de autenticação (login)
│   │   └── login/
│   ├── (dashboard)/               # Rotas autenticadas (sidebar)
│   │   ├── layout.tsx             # Layout com sidebar + perfil do usuário
│   │   ├── atendimento/           # Tela do vendedor (WhatsApp)
│   │   ├── kanban/                # Tarefas e funil
│   │   ├── leads/                 # Pipeline de leads
│   │   ├── clientes/              # Gestão de clientes
│   │   ├── produtos/              # Catálogo de produtos
│   │   ├── vendas/                # Histórico de vendas
│   │   ├── campanhas/             # Incentivos e metas (MVP)
│   │   ├── dashboard/             # Visão gerencial (⚠️ dados mockados)
│   │   ├── equipes/               # Gestão de equipes (só gestor)
│   │   ├── configuracoes/         # Perfil + gestão de vendedores
│   │   └── ajuda/                 # Central de ajuda
│   ├── api/                       # Rotas de API (server-side)
│   │   ├── atendimentos/          # Atendimentos + mensagens
│   │   ├── webhooks/waha/         # ⭐ Webhook principal WhatsApp
│   │   ├── webhooks/evolution/    # Legado (rollback)
│   │   └── ...                    # tarefas, clientes, leads, vendas, etc.
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── features/                  # Componentes por feature
│   ├── layout/                    # sidebar.tsx, header.tsx
│   └── ui/                        # shadcn/ui
├── lib/
│   ├── supabase/                  # clientes browser/server/admin
│   ├── waha.ts                    # Adapter WAHA (envio/sessão/contatos)
│   ├── waha-webhook.ts            # Parser de eventos (testado)
│   ├── telefone.ts                # Formatação unificada de telefone
│   ├── roteamento.ts              # Roteamento de conversas novas
│   ├── evolution-api.ts           # Legado/rollback
│   └── data/mock.ts               # Dados mockados
├── scripts/                       # utilitários (importação, diagnóstico)
│   └── rebase-base-clientes.js    # rebase da base + organograma (5 fases)
├── supabase/migrations/           # migrations SQL (009–069)
├── docs/                          # documentação (ver docs/README.md)
├── PROGRESSO.MD                   # diário de bordo
└── ...
```

## Convenções de Nomenclatura

### Arquivos
- **Páginas**: `page.tsx` (Next.js App Router)
- **Layouts**: `layout.tsx`
- **Componentes**: `kebab-case.tsx` (ex: `performance-realtime.tsx`)
- **Utilitários**: `camelCase.ts` (ex: `mock.ts`)

### Componentes React
- **PascalCase** para nomes de componentes
- **Interface/Type**: Mesmo nome do componente + `Props`

```tsx
// Exemplo
interface PerformanceRealTimeProps {
  vendedorId: string;
}

export function PerformanceRealTime({ vendedorId }: PerformanceRealTimeProps) {
  // ...
}
```

## Padrões de Código

### Imports
1. React/Next
2. Bibliotecas externas
3. Componentes UI (shadcn)
4. Componentes de features
5. Utilitários
6. Dados/Types

```tsx
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { PerformanceRealTime } from "@/components/features/atendimento/performance-realtime";

import { cn } from "@/lib/utils/cn";
import { vendedorAtual } from "@/lib/data/mock";
```

### Estrutura de Páginas

```tsx
"use client"; // Se necessário

import { ... } from "...";

/**
 * NomeDaPaginaPage
 * 
 * Descrição breve do que a página faz.
 */

export default function NomeDaPaginaPage() {
  // Hooks
  const [state, setState] = useState();
  
  // Funções
  const handleAction = () => { ... };
  
  // Render
  return (
    <div className="space-y-6">
      {/* Conteúdo */}
    </div>
  );
}
```

## Rotas Disponíveis

| Rota | Descrição | Grupo |
|------|-----------|-------|
| `/login` | Tela de autenticação | `(auth)` |
| `/atendimento` | Área de trabalho do vendedor | `(dashboard)` |
| `/kanban` | Tarefas e funil | `(dashboard)` |
| `/leads` | Pipeline de leads | `(dashboard)` |
| `/clientes` | Gestão de clientes | `(dashboard)` |
| `/produtos` | Catálogo de produtos | `(dashboard)` |
| `/vendas` | Histórico de vendas | `(dashboard)` |
| `/campanhas` | Campanhas e incentivos (MVP) | `(dashboard)` |
| `/dashboard` | Visão gerencial (⚠️ mock) | `(dashboard)` |
| `/equipes` | Gestão de equipes (só gestor) | `(dashboard)` |
| `/configuracoes` | Preferências + vendedores | `(dashboard)` |
| `/ajuda` | Central de ajuda | `(dashboard)` |

## Estado Atual (23/09/2026)

1. ✅ Supabase em produção — migrations `009`–`069` aplicadas; RLS parcial (pendente: Fase 3 da auditoria)
2. ✅ Autenticação e proteção de rotas ativas no `(dashboard)`
3. ✅ WhatsApp via **WAHA** em produção (`lib/waha.ts` + webhook `message.any`)
4. ⚠️ `/dashboard` ainda usa dados mockados
5. Próximos passos: unificar permissões gestor/vendedor (hoje duplicadas por rota) e RLS completo
