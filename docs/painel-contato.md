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
│   │ [Iniciar][Concluir]│ │
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
| Lista tarefas | `max-h-40 overflow-y-auto` |
| Form Criar Tarefa | `space-y-2` |

## Comportamento

- **Etiquetas**: colapsa por padrão (menos uso frequente)
- **Tarefas**: sempre aberta para visibilidade imediata
- **Criar Tarefa**: formulário com campos título, kanban, tipo, prioridade, data, hora
- **Ações rápidas nas tarefas**: Iniciar (a_fazer→em_andamento), Concluir (abre modal de venda), Voltar
- **Fetch automático**: etiquetas e tarefas carregam ao trocar de conversa

## API Endpoints Utilizados

- `GET /api/atendimentos/etiquetas?atendimento_id=` — Buscar etiquetas
- `POST /api/atendimentos/etiquetas` — Vincular etiqueta
- `DELETE /api/atendimentos/etiquetas?atendimento_id=&etiqueta=` — Remover etiqueta
- `GET /api/tarefas?cliente_nome=` — Buscar tarefas do cliente
- `POST /api/tarefas` — Criar tarefa
- `PATCH /api/tarefas` — Atualizar tarefa (mudar coluna, concluir)

## Histórico

- **2026-09-19**: Layout compactado — avatar 48px, dados em text-xs, tarefas sempre aberta
