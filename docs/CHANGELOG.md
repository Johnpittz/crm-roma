# Changelog — CRM ROMA

Todas as features documentadas, ordenadas por data (mais recente primeiro).

---

## 2026-09-21 — Busca de Contatos WhatsApp

**Status:** ✅ Concluído

**O que foi feito:**
Implementada funcionalidade de busca de contatos WhatsApp via Evolution API, permitindo aos vendedores buscar contatos na agenda da instância WhatsApp, verificar números e iniciar atendimentos diretamente pela tela de atendimento.

**Mudanças:**
- Novo modal `buscar-contatos-whatsapp.tsx` com campo de busca, lista de resultados e verificação de números
- Botão "Buscar Contatos WhatsApp" adicionado à página de atendimento
- Criado endpoint `GET /api/whatsapp/contacts` — lista contatos via Evolution API (`findContacts`)
- Criado endpoint `POST /api/whatsapp/check-number` — verifica existência de números (`checkWhatsAppNumbers`)
- Funções `findContacts` e `checkWhatsAppNumbers` adicionadas ao `lib/evolution-api.ts`
- Seleção de contato cria automaticamente um atendimento e abre o chat
- **Fix:** Contatos `@lid` (ID interno WhatsApp) são filtrados automaticamente — não têm número de telefone acionável

**Arquivos:**
- `lib/evolution-api.ts` — novas funções `findContacts` e `checkWhatsAppNumbers`
- `app/api/whatsapp/contacts/route.ts` — endpoint GET para busca de contatos
- `app/api/whatsapp/check-number/route.ts` — endpoint POST para verificação de números
- `components/features/atendimento/buscar-contatos-whatsapp.tsx` — modal de busca
- `app/(dashboard)/atendimento/page.tsx` — integração do modal e handler

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
