# Painel de Contato — CRM ROMA

Sidebar lateral direita exibida ao selecionar um atendimento no kanban.

## Arquivo
`components/features/atendimento/painel-contato.tsx`

## Estrutura

```
┌─────────────────────────┐
│  Header (nome + editar) │
│       [Avatar]          │
│  Status (Aberto/Encerr) │
│  📞 Tel  📧 Email       │
│  📅 Data  📄 CPF        │
├─────────────────────────┤
│ ▶ Etiquetas (colapsável)│
│ ▼ Tarefas (sempre aberta)│
│   ┌──────────────────┐  │
│   │ Tarefa card      │  │
│   │ 📋 Título        │  │
│   │ 📅 Data  💰 Valor│  │
│   │ [▶ Iniciar][✓ Concluir]│
│   └──────────────────┘  │
├─────────────────────────┤
│ ▶ Criar Tarefa (form)   │
│   Título / Kanban / Tipo│
│   Data / Hora           │
│   [Criar Tarefa]        │
└─────────────────────────┘
```

## Componentes

### `Secao`
Seção colapsável reutilizável.

**Props:**
- `titulo` (string) — Título da seção
- `children` (ReactNode) — Conteúdo
- `badge` (number, opcional) — Contador ao lado do título
- `sempreAberta` (boolean, opcional) — Se `true`, inicia aberta

### `PainelContato`
Componente principal.

**Props:**
- `atendimento` (Atendimento | null) — Dados do atendimento selecionado
- `onFechar` () => void — Callback ao fechar
- `onMarcarConcluido` (id: string) => void — Marcar atendimento como concluído
- `onEtiquetaChange` () => void — Callback quando etiqueta muda

## Convenções de Espaçamento

| Elemento | Classe |
|----------|--------|
| Header | `px-3 pt-3 pb-1.5` |
| Avatar | `h-12 w-12` (48px), `text-lg` |
| Status | `px-3 pb-2 gap-2` |
| Dados contato | `text-xs`, ícones `h-3.5 w-3.5`, `space-y-1` |
| Secao padding | `px-3 pb-2` |
| Card tarefa | `p-3 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 transition-all` |
| Título tarefa | `text-sm font-semibold leading-snug` |
| Badge coluna | `text-[10px] px-2 py-0.5 shrink-0` |
| Data tarefa | `text-xs text-slate-500 mb-1.5` |
| Valor venda | `text-xs text-emerald-600 font-semibold mb-1.5` |
| Botões ação | `text-xs px-3 py-1.5 rounded-lg font-medium` |
| Lista tarefas | `space-y-3 max-h-64 overflow-y-auto pr-1` |
| Form Criar Tarefa | `space-y-2` |

## Comportamento

- **Etiquetas**: colapsa por padrão (menos uso frequente)
- **Tarefas**: sempre aberta para visibilidade imediata
- **Criar Tarefa**: formulário com campos título, kanban, tipo, prioridade, data, hora
- **Ações rápidas nas tarefas**: Iniciar (a_fazer→em_andamento), Concluir (abre modal de venda), Voltar
- **Fetch automático**: etiquetas e tarefas carregam ao trocar de conversa
- **Hover nos cards**: borda azul e fundo sutil para indicar interatividade
- **Data exibida**: quando disponível, mostra data e hora da tarefa
- **Valor de venda**: exibido com ícone 💰 e destaque verde

## API Endpoints Utilizados

- `GET /api/atendimentos/etiquetas?atendimento_id=` — Buscar etiquetas
- `POST /api/atendimentos/etiquetas` — Vincular etiqueta
- `DELETE /api/atendimentos/etiquetas?atendimento_id=&etiqueta=` — Remover etiqueta
- `GET /api/tarefas?cliente_nome=` — Buscar tarefas do cliente
- `POST /api/tarefas` — Criar tarefa
- `PATCH /api/tarefas` — Atualizar tarefa (mudar coluna, concluir)

## Histórico

- **2026-09-19**: Layout compactado — avatar 48px, dados em text-xs, tarefas sempre aberta
- **2026-09-19**: Cards de tarefas maiores e mais visíveis — padding p-3, rounded-xl, botões text-xs px-3 py-1.5, scroll max-h-64, hover effect azul, data da tarefa exibida
