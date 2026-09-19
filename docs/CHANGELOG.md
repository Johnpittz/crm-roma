# Changelog — CRM ROMA

Todas as features documentadas, ordenadas por data (mais recente primeiro).

---

## 2026-09-19 — Cards de Tarefas Maiores no Painel de Contato

**Status:** ✅ Concluído

**O que foi feito:**
Aumentado tamanho e visibilidade dos cards de tarefas na seção "Tarefas" do painel de contato lateral, facilitando o trabalho com o kanban sem sair da tela de atendimento.

**Mudanças:**
- Card: padding `p-2` → `p-3`, border-radius `rounded-lg` → `rounded-xl`
- Título: `text-xs font-medium` → `text-sm font-semibold leading-snug`
- Botões de ação: `text-[10px] px-2 py-0.5` → `text-xs px-3 py-1.5 rounded-lg font-medium`
- Espaçamento entre cards: `space-y-2` → `space-y-3`
- Área de scroll: `max-h-40` → `max-h-64` com `pr-1`
- Hover effect: `hover:border-blue-300 hover:bg-blue-50/30 transition-all`
- Badge coluna: `shrink-0` para não colapsar
- Data da tarefa exibida quando disponível
- Valor de venda com ícone 💰 e `font-semibold`

**Arquivo:** `components/features/atendimento/painel-contato.tsx`

---

## 2026-09-19 — Layout Compactado do Painel de Contato

**Status:** ✅ Concluído

**O que foi feito:**
Compactado o layout do painel de contato lateral para melhor aproveitamento de espaço.

**Mudanças:**
- Avatar reduzido para 48px (h-12 w-12)
- Dados do contato em text-xs com ícones h-3.5 w-3.5
- Header com px-3 pt-3 pb-1.5
- Tarefas sempre aberta por padrão
- Etiquetas colapsada por padrão

**Arquivo:** `components/features/atendimento/painel-contato.tsx`
