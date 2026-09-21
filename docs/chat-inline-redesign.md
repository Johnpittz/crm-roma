# Chat Inline — Redesign WhatsApp-Style

## Visão Geral
O componente `chat-inline.tsx` é o coração do atendimento WhatsApp no CRM ROMA. Ele exibe a conversa entre o operador e o cliente, permitindo envio de texto, mídia (imagem, áudio, vídeo, documento), gravação de áudio, e transferência de atendimento.

## Arquivo Principal
- `components/features/atendimento/chat-inline.tsx` (~650 linhas)

## APIs Utilizadas
| Endpoint | Método | Uso |
|----------|--------|-----|
| `/api/atendimentos/mensagens` | GET | Buscar mensagens do atendimento |
| `/api/atendimentos/mensagens` | POST | Enviar mensagem (texto ou mídia) |
| `/api/atendimentos` | PATCH | Transferir atendimento / marcar como lido |
| `/api/send/media` | POST | Enviar mídia via Evolution API |
| `/api/vendedores` | GET | Listar vendedores para transferência |
| `/api/media-download` | GET | Proxy de download de mídia do WhatsApp |
| `/api/media` | GET | Proxy de mídia genérico |

## Estrutura do Componente

### Interfaces
- `Mensagem` — Mensagem do chat (texto, mídia, áudio)
- `Atendimento` — Atendimento selecionado
- `ChatInlineProps` — Props do componente
- `Vendedor` — Vendedor para transferência

### States Principais
| State | Tipo | Uso |
|-------|------|-----|
| `mensagens` | `Mensagem[]` | Lista de mensagens carregadas |
| `novaMensagem` | `string` | Texto do input |
| `enviando` | `boolean` | Indica envio em andamento |
| `isRecording` | `boolean` | Indica gravação de áudio |
| `modoTransferencia` | `boolean` | Modo de transferência de atendimento |

### Fluxo de Envio
1. **Texto**: Usuário digita → Enter ou botão Send → POST `/api/atendimentos/mensagens` → Evolution API `sendText`
2. **Arquivo**: Botão Paperclip → Input file → FileReader base64 → POST `/api/send/media` → Evolution API `sendMedia` → POST `/api/atendimentos/mensagens` para salvar no banco
3. **Áudio**: Botão Mic → MediaRecorder API → onStop → POST `/api/send/media` → Evolution API `sendWhatsAppAudio` → POST `/api/atendimentos/mensagens`

### Fluxo de Recebimento
- **Polling 15s**: `fetchMensagens(true)` busca novas mensagens sem loading visual
- **Webhook Evolution API**: Mensagens chegam via webhook e são salvas no banco automaticamente
- **Fallback**: Se não há mensagens na tabela, usa `ultima_mensagem` do atendimento

### Renderização de Mídia
A função `renderMidia()` detecta o tipo e resolve a URL:
- WhatsApp CDN (`mmg.whatsapp.net`) → Proxy via `/api/media-download`
- Data URL ou Supabase Storage → URL direta
- Outros → Proxy via `/api/media`

Tipos suportados: `image`, `audio`, `video`, `document`, `sticker`

### Componentes Internos
- `AudioPlayer` — Player de áudio estilo WhatsApp com play/pause, barra de progresso, duração

## Visual WhatsApp
- **Bubbles cliente**: `bg-white` com `rounded-tl-none`
- **Bubbles operador**: `bg-[#D9FDD3]` com `rounded-tr-none`
- **Fundo chat**: `bg-[#efeae2]` com pattern SVG sutil
- **Header**: `bg-[#f0f2f5]` com avatar, nome, telefone, ícones de ação
- **Input**: Container `bg-white rounded-full` com emoji, attach, texto, mic/send
- **Timestamps**: Dentro da bubble, `text-[11px] text-[#667781]`
- **Checkmarks**: `CheckCheck` azul `text-[#53bdeb]` para mensagens do operador
- **Separadores de data**: "HOJE", "ONTEM", ou data formatada

## Dependências
- React hooks: `useState`, `useEffect`, `useRef`, `useCallback`
- UI: `Button`, `Input`, `Badge`, `ScrollArea` (shadcn/ui)
- Ícones: Lucide React
- Supabase: `createClient` para auth
- Util: `cn()` para classes condicionais

## Bugs Corrigidos Nesta Versão
1. **Timestamp fora da bubble** → Agora dentro da bubble, alinhado à direita
2. **Timestamp invisível** → Cor `#667781` (cinza legível)
3. **Sem checkmarks** → ✓✓ azul em todas mensagens do operador
4. **Sem separadores de data** → "HOJE", "ONTEM", ou data
5. **Sem hover actions** → Emoji + Reply ao passar mouse
6. **Header não-WhatsApp** → Avatar, nome, telefone, ícones de busca/opções
7. **Input não-WhatsApp** → Emoji, attach, input arredondado, mic/send
8. **Áudio player genérico** → Player estilo WhatsApp com play/pause + progresso
9. **Imagens sem caption** → Caption sobreposta com gradiente
10. **Documento genérico** → Card com ícone azul + nome do arquivo
11. **PDF não aparecia no CRM** → Webhook agora salva `file_name` ao receber documentos

## Changelog

### v2 — 21/09/2026
- Fix: webhook `file_name` não era salvo ao receber documentos do WhatsApp
- Adicionado `fileName` ao extrator de dados da Evolution API
- Adicionado `file_name` nos dois INSERT do webhook (atendimento existente + novo)

## Notas para Próximas Tasks
- Hover actions (emoji picker e reply) são visuais por enquanto — precisam de implementação futura
- Checkmarks são sempre ✓✓ — futuro: status real via webhook (message update)
- Indicador "digitando" é mostrado apenas quando `enviando === true` (após enviar)
- Buscar contatos WhatsApp está disponível via modal separado
