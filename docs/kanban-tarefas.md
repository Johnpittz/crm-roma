# Kanban de Tarefas — CRM ROMA

Documentação do board Kanban de tarefas do módulo de Atendimento, composto pelos componentes `KanbanTarefas` e `DashboardKanban`.

---

## 1. Visão Geral

O Kanban de Tarefas é o painel principal de gestão do pipeline de vendas. Ele exibe tarefas e atendimentos organizados em colunas, permitindo ao vendedor acompanhar o fluxo de cada lead — desde a chegada até o fechamento.

- **Arquivo principal:** `components/features/atendimento/kanban-tarefas.tsx`
- **Dashboard resumo:** `components/features/atendimento/dashboard-kanban.tsx`
- **Biblioteca de drag-and-drop:** `@hello-pangea/dnd`
- **Backend:** API REST em `/api/tarefas` (CRUD), autenticação via Supabase

---

## 2. Colunas do Board

O board possui três colunas fixas, representando as fases do pipeline:

| ID              | Título      | Cor de fundo     | Descrição                                            |
|-----------------|-------------|------------------|------------------------------------------------------|
| `a_fazer`       | A Fazer     | `bg-slate-100`   | Tarefas aguardando ação do vendedor                   |
| `em_andamento`  | Andamento   | `bg-blue-50`     | Tarefas em que o vendedor já interagiu com o lead      |
| `concluida`     | Concluído   | `bg-emerald-50`  | Tarefas finalizadas (últimos 7 dias para atendimentos) |

**Filtro por coluna:** Um `<Select>` no header permite filtrar para ver apenas uma coluna específica ou todas ao mesmo tempo. Quando "Todas" está selecionado, o layout usa `grid-cols-3`; ao filtrar uma coluna, o layout muda para `grid-cols-1` (coluna única larga).

---

## 3. Estrutura do Card de Tarefa

Cada card (`CardAtendimentoKanban`) exibe:

- **Prioridade** — Badge colorido:
  - `baixa` → `bg-slate-100 text-slate-700`
  - `media` → `bg-blue-100 text-blue-700`
  - `alta` → `bg-orange-100 text-orange-700`
  - `urgente` → `bg-red-100 text-red-700` + ícone `AlertCircle`

- **Ícone do tipo de tarefa** — Emoji mapeado pelo campo `tipo`:
  - `visita` → 🏢
  - `ligacao` → 📞
  - `whatsapp` → 💬
  - `email` → 📧
  - `reuniao` → 🤝
  - `follow_up` → 🔄
  - `prospeccao` → 🔍
  - `outro` → 📋

- **Título** — Texto truncado (fonte `text-xs`, truncate)

- **Origem do lead** (badge ao lado do título, quando disponível):
  - `prospeccao_b2b` → 🔍 Prospecção
  - `whatsapp` → 💬 WhatsApp
  - `indicacao` → 🤝 Indicação
  - `site` → 🌐 Site
  - `pixel` → 📊 Pixel
  - `api` → 🔗 API
  - `importacao` → 📁 Importação
  - `manual` → ✋ Manual
  - `evento` → 🎪 Evento

- **Nome do cliente** — `nome_razao_social` do relacionamento `clientes`, ou `cliente_nome` direto

- **Horário de início** — Exibido com ícone `Clock` quando `hora_inicio` existe

- **Ações** (aparecem no hover do card):
  - Botão de excluir (`Trash2`) — exibe confirmação `confirm()` antes de deletar
  - Botão de mais opções (`MoreHorizontal`) — placeholder (ações futuras)

### Interface `Tarefa`

```typescript
interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  prioridade: string;
  status: string;
  data_inicio: string | null;
  hora_inicio: string | null;
  data_fim: string | null;
  hora_fim: string | null;
  resultado: string | null;
  observacao_resultado: string | null;
  valor_venda: number | null;
  cliente_nome: string | null;
  coluna_kanban: string;
  ordem: number;
  origem_lead: string | null;
  created_at: string;
  clientes: { id: string; nome_razao_social: string } | null;
}
```

---

## 4. Drag-and-Drop (Arrastar e Soltar)

Utiliza `@hello-pangea/dnd` com `DragDropContext`, `Droppable` e `Draggable`.

### Comportamento ao arrastar

1. **Arrastar para `em_andamento` ou `a_fazer`:**
   - Atualização otimista imediata no estado local
   - Requisição `PATCH` para `/api/tarefas` com `{ id, coluna_kanban, ordem }`
   - Em caso de erro, reverte com `fetchTarefas()`

2. **Arrastar para `concluida`:**
   - **NÃO move a tarefa imediatamente**
   - Abre o `ModalDetalhesTarefa` com `iniciarConcluindo={true}`
   - O modal cuida do fluxo de conclusão (registro de resultado, valor da venda, observações)
   - Somente após confirmação no modal a tarefa é efetivamente movida para "Concluído"

3. **Mover dentro da mesma coluna:** Ignorado (sem reordenação intra-coluna implementada)

4. **Reordenação:** A `ordem` é calculada como `tarefasNaColunaDestino.length` (append ao final)

### Feedback visual durante drag

- Card sendo arrastado: `shadow-lg ring-2 ring-blue-500 rotate-2`
- Coluna de destino com hover: `bg-slate-200/50 rounded-lg`
- Cursor: `cursor-grab` (normal), `active:cursor-grabbing` (arrastando)

---

## 5. Ações Disponíveis

### Criar Tarefa
- Botão `NovaTarefaModal` no header do Kanban
- Também pode ser criada a partir da sidebar do painel-contato

### Editar/Ver Detalhes
- Clique em qualquer card abre `ModalDetalhesTarefa`
- O modal permite editar todos os campos da tarefa

### Concluir Tarefa
- Via drag para coluna "Concluído" → abre modal em modo conclusão
- Permite preencher: resultado, observação do resultado, valor da venda

### Excluir Tarefa
- Ícone `Trash2` aparece no hover do card
- Confirmação via `confirm("Excluir esta tarefa?")`
- Requisição `DELETE` para `/api/tarefas?id={id}`

### Filtrar
- Filtro por coluna via `<Select>` no header
- Filtro por texto de busca (`busca` prop) — busca em título, descrição e nome do cliente
- Filtro por período (`dataInicio`, `dataFim`) — verifica se qualquer data da tarefa (criação, início ou fim) está no período

---

## 6. Interface `KanbanTarefasProps`

```typescript
interface KanbanTarefasProps {
  atendimentos: Atendimento[];  // Lista de atendimentos para enriquecer o board
  onAbrirChat: (a: Atendimento) => void;  // Callback para abrir chat do atendimento
  onRefresh?: () => void;  // Trigger para recarregar tarefas
  onTarefaAtualizada?: () => void;  // Callback após atualização de tarefa
  busca?: string;  // Termo de busca para filtrar tarefas
  dataInicio?: string;  // Data inicial do filtro
  dataFim?: string;  // Data final do filtro
}
```

---

## 7. Mapeamento de Atendimentos para Colunas

O Kanban também exibe atendimentos classificados automaticamente nas colunas:

| Coluna         | Regarda do atendimento                                           |
|----------------|------------------------------------------------------------------|
| `a_fazer`      | Status `aberto` E vendedor **não** interagiu ainda               |
| `em_andamento` | Status `aberto` E vendedor **já** interagiu                      |
| `concluida`    | Status `fechado` E data de fechamento nos últimos 7 dias          |

Um atendimento é considerado "em andamento" quando `vendedor_interagiu === true` ou `ultima_mensagem_remetente === "vendedor"`.

---

## 8. DashboardKanban — Painel Resumo

O componente `DashboardKanban` (`dashboard-kanban.tsx`) é um dashboard executivo que consolida métricas do Kanban e de outros módulos.

### Seções do Dashboard

1. **Hero Carousel** — Banner rotativo editável (salvo em `localStorage`), com 3 banners padrão e opção de criar/editar/remover banners customizados com imagem de fundo

2. **Cards de Métricas Principais** (grid 4 colunas):
   - Pedidos Hoje (tarefas com `data_inicio` = hoje)
   - Faturamento (soma de `valor_total` das vendas)
   - Vendas (quantidade total)
   - Ticket Médio (média de `valor_total`)

3. **Fluxo Operacional** — Grid 2x3 com indicadores:
   - Leads Novos (atendimentos abertos)
   - Clientes Resgate (atendimentos pendentes sem vendedor)
   - Clientes em Potenciais (tarefas concluídas)
   - Pós-Venda (follow-ups pendentes)
   - Tarefas a fazer (pendentes no kanban)
   - Tarefas atrasadas (`data_fim` no passado e não concluída)

4. **Radar Inteligente** — Painel lateral com alertas:
   - Tarefas atrasadas (últimos 7 dias)
   - Sem retorno (atendimentos aguardando)
   - Mensagens não lidas
   - Meta do mês (progresso percentual)

5. **Tarefas Recentes** — Lista das 5 últimas tarefas com ícone da coluna, prioridade e link "Ver todas →" para `/kanban?tab=tarefas`

6. **Performance do Funil** — Barras de progresso com as fases do funil:
   - Enviado, sem retorno (`a_fazer`)
   - Negociação Inicial — Produto/Prazo (`em_andamento`)
   - Negociação Final — Desconto/Prazo (follow-ups pendentes)
   - Acordo Verbal (`concluida`)
   - Total vendido em R$

### Dados consumidos

- `/api/tarefas` — todas as tarefas para cálculo de estatísticas
- `/api/atendimentos` — atendimentos abertos e pendentes
- `/api/vendas` — vendas realizadas para faturamento e ticket médio

---

## 9. Dependências

- `@hello-pangea/dnd` — drag-and-drop
- `lucide-react` — ícones (`MoreHorizontal`, `Clock`, `AlertCircle`, `Trash2`, `MessageCircle`, etc.)
- `@/components/ui/*` — componentes shadcn/ui (`Card`, `Badge`, `Button`, `Select`, `ScrollArea`, `Progress`)
- `@/lib/supabase/client` — cliente Supabase para autenticação
- `@/lib/utils` (`cn`) — utilitário de classes condicionais
- Modais auxiliares: `NovaTarefaModal`, `ModalDetalhesTarefa`, `CardAtendimentoKanban`
