# Redesign Chat-Inline CRM ROMA — Estilo WhatsApp Web

> **Para Hermes:** Executar este plano task-by-task. Commit após cada task.

**Goal:** Redesenhar o componente `chat-inline.tsx` para parecer ao máximo com o WhatsApp Web real, corrigindo bugs visuais e funcionais existentes.

**Architecture:** Reescrever o componente mantendo a mesma estrutura de props/API. Focar em: visual WhatsApp real (cores, bubbles, timestamps), hover actions, separadores de data, indicador de digitação, e polish geral.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide React

**Projeto:** `/root/crm-roma` (CRM ROMA)

---

## Análise dos Bugs Visuais Atuais (vs WhatsApp Real)

1. **Cor das bubbles do operador** — Usa `bg-green-600` (verde claro). WhatsApp usa `bg-[#D9FDD3]` (verde muito claro) com texto verde-escuro
2. **Timestamp no canto errado** — Horário aparece fora da bubble. WhatsApp coloca horário DENTRO da bubble, à direita
3. **Cor do timestamp do cliente** — Usa `text-green-200` (quase invisível). WhatsApp usa `text-[#667781]` (cinza)
4. **Sem separadores de data** — WhatsApp tem "HOJE", "ONTEM", datas entre grupos de mensagens
5. **Sem indicador de entrega/checkmark** — Mensagens enviadas deveriam ter ✓ ou ✓✓
6. **Sem hover actions** — WhatsApp mostra emoji reaction + reply ao passar mouse
7. **Header não é estilo WhatsApp** — Falta status de presença, ícones de busca/arquivo/3-pontos
8. **Input não é estilo WhatsApp** — Falta ícone de emoji, formato arredondado correto
9. **Sem efeito "digitando"** — Quando operador está escrevendo, cliente deveria ver indicador
10. **Áudio player não estilo WhatsApp** — Player genérico em vez do estilo WhatsApp (bolha verde com waveform)
11. **Imagens sem preview adequado** — Tamanho e bordas diferentes do WhatsApp

---

## Task 1: Visual Base — Cores e Bubble Styles WhatsApp-Real

**Objetivo:** Ajustar cores das bubbles, fundo do chat, e tipografia para match exato com WhatsApp Web.

**Files:**
- Modify: `components/features/atendimento/chat-inline.tsx`

**Mudanças:**
- Fundo do chat: `bg-[#efeae2]` com pattern sutil (WhatsApp usa wallpaper)
- Bubble cliente: `bg-white` com `shadow-sm`, borda `border-none`
- Bubble operador: `bg-[#D9FDD3]` com texto `text-[#111b21]`
- Timestamp DENTRO da bubble, alinhado à direita
- Cor timestamp cliente: `text-[#667781]`
- Cor timestamp operador: `text-[#667781]`
- Arredondamento: `rounded-lg` com cantos assimétricos (bubble cliente: canto inferior-esquerdo reto, bubble operador: canto inferior-direito reto)

---

## Task 2: Header WhatsApp-Style

**Objetivo:** Header do chat com avatar, nome, telefone, status de presença, e ícones de ação.

**Files:**
- Modify: `components/features/atendimento/chat-inline.tsx`

**Mudanças:**
- Avatar circular com iniciais (fundo `bg-[#DFE5E7]`)
- Nome em `text-[#111b21] font-normal`
- Telefone/status em `text-[#667781] text-[13px]`
- Ícones à direita: Phone, Search (lupa), 3-pontos (⋮)
- Borda inferior `border-b border-[#e9edef]`
- Fundo header: `bg-[#f0f2f5]`

---

## Task 3: Separadores de Data

**Objetivo:** Adicionar separadores "HOJE", "ONTEM", ou data entre grupos de mensagens de dias diferentes.

**Files:**
- Modify: `components/features/atendimento/chat-inline.tsx`

**Mudanças:**
- Função `formatarDataSeparador(data)` que retorna "HOJE", "ONTEM", ou "DD/MM/YYYY"
- Bubble separadora centralizada: `bg-[#E2DCCC]` com `text-[#54656f]` `text-[12.5px]` `py-[6px] px-[12px]` `rounded-lg` `shadow-sm`
- Lógica: comparar data da mensagem atual com anterior, inserir separador quando dia muda

---

## Task 4: Indicador de Entrega (Checkmarks)

**Objetivo:** Mostrar ✓ (enviada) ou ✓✓ (entregue) nas mensagens do operador, como no WhatsApp.

**Files:**
- Modify: `components/features/atendimento/chat-inline.tsx`

**Mudanças:**
- Ícone de check: usar SVG customizado ou Lucide `Check`/`CheckCheck`
- Cor: `text-[#53bdeb]` (azul WhatsApp) quando entregue, `text-[#8696a0]` quando só enviada
- Posicionar ao lado do timestamp, dentro da bubble
- Por enquanto, todas as mensagens do operador mostram ✓✓ (deliverado) — futuro: status real do webhook

---

## Task 5: Hover Actions (Reply + Reaction)

**Objetivo:** Ao passar mouse sobre mensagem, mostrar mini toolbar com emoji e reply, como WhatsApp.

**Files:**
- Modify: `components/features/atendimento/chat-inline.tsx`

**Mudanças:**
- Container da mensagem com `group` class
- Toolbar aparece com `opacity-0 group-hover:opacity-100 transition-opacity`
- Posição: canto superior da bubble (externo), alinhado à direita para operador, esquerda para cliente
- Botões: 😊 (reaction picker futuro), ↩️ (reply futuro)
- Fundo toolbar: `bg-white` com `shadow-md rounded-md`
- Espaçamento: `absolute -top-8` (acima da bubble)

---

## Task 6: Input WhatsApp-Style

**Objetivo:** Barra de input no estilo WhatsApp com emoji, attach, mic, e input arredondado.

**Files:**
- Modify: `components/features/atendimento/chat-inline.tsx`

**Mudanças:**
- Fundo input: `bg-[#f0f2f5]`
- Container: `bg-white rounded-full` com `py-[9px] px-[12px]`
- Botão emoji (😊) à esquerda do input
- Input sem borda visível, `placeholder:text-[#667781]`
- Botão attach (📎) ao lado do emoji
- Botão mic (🎤) ou Send (➤) à direita
- Quando tem texto: mostra Send (seta verde). Quando vazio: mostra Mic
- Botão Send: `bg-[#00a884]` (verde WhatsApp) com ícone de seta para cima/direita

---

## Task 7: Indicador "Digitando" (Placeholder)

**Objetivo:** Mostrar "digitando..." no chat quando o operador está escrevendo (simulação visual por enquanto).

**Files:**
- Modify: `components/features/atendimento/chat-inline.tsx`

**Mudanças:**
- Quando `enviando === true`, mostrar bolha animada "digitando..." antes da mensagem enviada
- Bolha: `bg-[#D9FDD3]` com 3 pontos animados
- Animação: 3 dots com delay escalonado (keyframes)
- Posicionar antes da última mensagem enviada

---

## Task 8: Áudio Player WhatsApp-Style

**Objetivo:** Player de áudio no estilo WhatsApp (bolha verde com ícone play + waveform + duração).

**Files:**
- Modify: `components/features/atendimento/chat-inline.tsx`

**Mudanças:**
- Container: `bg-[#D9FDD3]` ou `bg-white` dependendo do remetente
- Ícone play/pause circular
- Barra de progresso simples (div com bg cinza + progresso verde)
- Duração do áudio formatada `M:SS`
- Largura: `min-w-[250px]`

---

## Task 9: Imagem WhatsApp-Style (Preview Adequado)

**Objetivo:** Imagens com preview correto, bordas arredondadas, e caption dentro da imagem.

**Files:**
- Modify: `components/features/atendimento/chat-inline.tsx`

**Mudanças:**
- Imagem com `rounded-lg overflow-hidden`
- Caption: sobreposta na parte inferior com gradiente escuro semi-transparente
- Tamanho máximo: `max-w-[330px]`
- Corner radius: `rounded-lg` (8px)
- Hover: levemente mais escuro com cursor pointer

---

## Task 10: Mensagens Deletadas e Sistema

**Objetivo:** Mensagens do sistema (data, "mensagem apagada") com visual correto.

**Files:**
- Modify: `components/features/atendimento/chat-inline.tsx`

**Mudanças:**
- Mensagem deletada: ícone 🚫 + texto riscado `line-through text-[#8696a0]`
- Mensagens de sistema centralizadas com fundo `bg-[#E2DCCC]`
- Suporte para `tipo_midia === "deleted"` futuro

---

## Task 11: Polish Final e Responsividade

**Objetivo:** Ajustes finos de padding, margin, scroll, e comportamento mobile.

**Files:**
- Modify: `components/features/atendimento/chat-inline.tsx`

**Mudanças:**
- Espaçamento entre bubbles: `mb-[2px]` (WhatsApp usa espaçamento mínimo)
- Scroll suave com `scroll-behavior: smooth`
- Auto-scroll para baixo em novas mensagens
- Mobile: input sticky no fundo, bubbles com `max-w-[85%]`
- Tecla Enter para enviar (já existe), Shift+Enter para quebra de linha

---

## Validação

1. Abrir crm-roma-ten.vercel.app/atendimento
2. Abrir uma conversa
3. Verificar: bubbles com cores WhatsApp, timestamp dentro, separadores de data
4. Enviar mensagem: verificar ✓✓, scroll, input estilo
5. Enviar imagem: verificar preview
6. Enviar áudio: verificar player
7. Passar mouse: verificar hover actions
8. Verificar header com avatar, nome, ícones

## Riscos

- Mudanças visuais podem afetar其他 componentes que importam classes do chat
- áudio recording existente pode quebrar se mudarmos o input area
- Commit granular permite revert fácil (git revert por commit)

## Revert Strategy

Se algo quebrar: `git revert <commit-hash>` do commit específico. Cada task é um commit separado.
