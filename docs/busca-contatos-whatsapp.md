# Busca de Contatos WhatsApp

> **Módulo:** Atendimento  
> **Última atualização:** Setembro 2026  
> **Status:** ✅ Em produção

---

## 1. Visão Geral

A funcionalidade **Busca de Contatos WhatsApp** permite que operadores do CRM ROMA
pesquisem contatos diretamente da agenda do WhatsApp (via Evolution API), visualizem
informações básicas e iniciem um novo atendimento com o contato selecionado em poucos
cliques.

### Fluxo resumido

1. O operador clica no botão **"Novo Contato"** na barra lateral de atendimentos.
2. Um modal abre com a lista de contatos da instância WhatsApp (agenda + contatos de grupos).
3. O operador pode digitar um termo de busca (nome ou número) que filtra em tempo real.
4. Ao clicar em um contato, o sistema cria um novo registro de atendimento no Supabase
   e abre o chat automaticamente.

---

## 2. Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NAVEGADOR (Next.js)                         │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  AtendimentoPage                                              │  │
│  │  ┌─────────────────────┐    ┌─────────────────────────────┐  │  │
│  │  │ ListaAtendimentos   │    │ BuscarContatosWhatsApp      │  │  │
│  │  │ Lateral             │    │ (Modal)                     │  │  │
│  │  │                     │    │                             │  │  │
│  │  │ [Novo Contato] ─────┼───►│  Debounced search input    │  │  │
│  │  │                     │    │  Lista de contatos          │  │  │
│  │  │                     │◄───┤  onSelect → handleContato   │  │  │
│  │  └─────────────────────┘    └──────────────┬──────────────┘  │  │
│  │                                            │                  │  │
│  │  handleContatoSelecionado()                │                  │  │
│  │         │                                  │                  │  │
│  │         ▼                                  │                  │  │
│  │  POST /api/atendimentos                   │                  │  │
│  │  (cria atendimento)                        │                  │  │
│  └─────────┬─────────────────────────────────┘                  │  │
└────────────┼──────────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────┐       ┌──────────────────────────────┐
│  API Routes (Next.js)        │       │  Supabase                    │
│                              │       │                              │
│  GET  /api/whatsapp/contacts │       │  ┌────────────────────┐      │
│  POST /api/whatsapp/         │       │  │ atendimentos       │      │
│       check-number           │       │  └────────────────────┘      │
│  POST /api/atendimentos      │       └──────────────────────────────┘
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  lib/evolution-api.ts        │
│                              │
│  findContacts()              │──► POST /chat/findContacts/{instance}
│  checkWhatsAppNumbers()      │──► POST /chat/whatsappNumbers/{instance}
│  formatarTelefone()          │──► helper
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Evolution API Server        │
│  (localhost:8082 interno)    │
└──────────────────────────────┘
```

---

## 3. Endpoints da API Interna

### 3.1 GET /api/whatsapp/contacts

Busca contatos da instância WhatsApp via Evolution API.

**Query Parameters:**

| Parâmetro  | Tipo   | Obrigatório | Padrão | Descrição                        |
|------------|--------|-------------|--------|----------------------------------|
| `search`   | string | Não         | —      | Termo de busca (nome ou número)  |
| `limit`    | number | Não         | `100`  | Máximo de contatos (até 500)     |
| `instance` | string | Não         | —      | Nome da instância (default: ROMA_1) |

**Resposta de sucesso (200):**

```json
{
  "success": true,
  "contacts": [
    {
      "id": "3E22AD6A8D21AE12C15F4C576AFABE9E@lid",
      "remoteJid": "5511999887766@s.whatsapp.net",
      "pushName": "João Silva",
      "profilePicUrl": "https://pps.whatsapp.net/v/...",
      "isSaved": true,
      "isGroup": false,
      "type": "contact"
    }
  ],
  "total": 1
}
```

**Resposta de erro (400 — limite excedido):**

```json
{
  "error": "Máximo de 500 contatos por requisição"
}
```

**Resposta de erro (500):**

```json
{
  "error": "Erro ao buscar contatos"
}
```

---

### 3.2 POST /api/whatsapp/check-number

Verifica se números específicos existem no WhatsApp.

**Body (JSON):**

```json
{
  "numbers": ["11999887766", "21988776655"],
  "instance": "ROMA_1"
}
```

| Campo      | Tipo     | Obrigatório | Descrição                              |
|------------|----------|-------------|----------------------------------------|
| `numbers`  | string[] | Sim         | Array de números (até 20 por request)  |
| `instance` | string   | Não         | Nome da instância (default: ROMA_1)    |

**Resposta de sucesso (200):**

```json
{
  "success": true,
  "results": [
    { "number": "5511999887766", "exists": true, "jid": "5511999887766@s.whatsapp.net" },
    { "number": "5521988776655", "exists": false, "jid": null }
  ]
}
```

**Resposta de erro (400 — limite):**

```json
{
  "error": "Máximo de 20 números por requisição"
}
```

---

## 4. Componente BuscarContatosWhatsApp

### 4.1 Localização

```
components/features/atendimento/buscar-contatos-whatsapp.tsx
```

### 4.2 Props

```typescript
interface BuscarContatosWhatsAppProps {
  open: boolean;      // Controla visibilidade do modal
  onClose: () => void; // Callback ao fechar o modal
  onSelect: (contact: WhatsAppContact) => void; // Callback ao selecionar contato
  instance?: string;  // ID da instância Evolution API (opcional)
}
```

### 4.3 Interface WhatsAppContact

```typescript
interface WhatsAppContact {
  id: string;                // ID do contato no WhatsApp
  remoteJid: string;         // JID no formato xxx@s.whatsapp.net ou xxx@lid
  pushName: string | null;   // Nome do contato (pode ser null)
  profilePicUrl: string | null; // URL da foto de perfil
  isSaved: boolean;          // Se o contato está salvo na agenda
  isGroup: boolean;          // Se é grupo
  type: string;              // Tipo (contact, group, etc.)
}
```

### 4.4 Comportamento

- **Abertura:** Ao abrir (`open=true`), limpa a busca e carrega todos os contatos.
- **Debounce:** A busca tem debounce de 300ms para evitar chamadas excessivas à API.
- **Filtro client-side:** O filtro por nome/número é feito também no lado do servidor
  (dentro de `findContacts()`), mas o componente filtra os resultados recebidos.
- **Seleção:** Ao clicar em um contato, chama `onSelect(contact)`, fecha o modal
  e limpa o estado interno.
- **Extração de telefone:** A função `extractPhone()` remove os sufixos `@s.whatsapp.net`
  e `@lid` do JID para exibir apenas o número.

### 4.5 Uso no AtendimentoPage

```tsx
// Estado
const [buscarContatosAberto, setBuscarContatosAberto] = useState(false);

// Botão de abertura
<button onClick={() => setBuscarContatosAberto(true)}>
  <UserPlus className="h-3.5 w-3.5" />
  <span>Novo Contato</span>
</button>

// Modal
<BuscarContatosWhatsApp
  open={buscarContatosAberto}
  onClose={() => setBuscarContatosAberto(false)}
  onSelect={handleContatoSelecionado}
/>
```

---

## 5. Integração no AtendimentoPage

### 5.1 handleContatoSelecionado

Quando um contato é selecionado no modal, a função `handleContatoSelecionado`
é executada no `page.tsx` principal:

```typescript
const handleContatoSelecionado = useCallback(async (contact: WhatsAppContact) => {
  // 1. Extrai o telefone removendo sufixos do JID
  const telefone = contact.remoteJid
    .replace("@s.whatsapp.net", "")
    .replace("@lid", "");

  // 2. Cria o atendimento via POST /api/atendimentos
  const res = await fetch("/api/atendimentos", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      telefone_cliente: telefone,
      nome_cliente: contact.pushName || "Cliente",  // fallback se pushName for null
    }),
  });

  // 3. Após criar, atualiza a lista de atendimentos (silent)
  await fetchAtendimentos(true);

  // 4. Busca o atendimento recém-criado e abre no chat
  const novoAtendimento = await res.json();
  if (novoAtendimento?.atendimento_id) {
    const listRes = await fetch("/api/atendimentos", { headers: { Authorization: `Bearer ${token}` } });
    const listData = await listRes.json();
    const atendimento = listData.atendimentos?.find(a => a.id === novoAtendimento.atendimento_id);
    if (atendimento) setAtendimentoChat(atendimento);
  }
}, [supabase, fetchAtendimentos]);
```

**Fluxo detalhado:**

```
Seleção de contato
       │
       ▼
Extrair telefone do remoteJid
       │
       ▼
POST /api/atendimentos { telefone_cliente, nome_cliente }
       │
       ▼
Atualizar lista de atendimentos (silencioso)
       │
       ▼
Buscar atendimento recém-criado na lista
       │
       ▼
Abrir ChatInline com o atendimento
```

---

## 6. Funções da Evolution API (lib/evolution-api.ts)

### 6.1 findContacts

```typescript
export async function findContacts(params: {
  search?: string;
  limit?: number;
  instance?: string;
}): Promise<{
  success: boolean;
  contacts: Array<{
    id: string;
    remoteJid: string;
    pushName: string | null;
    profilePicUrl: string | null;
    isSaved: boolean;
    isGroup: boolean;
    type: string;
  }>;
  total: number;
  error?: string;
}>
```

- **Endpoint Evolution API:** `POST /chat/findContacts/{instance}`
- **Body enviado:** `{ where: {}, limit }`
- **Filtro de busca:** Feito client-side após receber os dados — filtra por `pushName` e `remoteJid`.
- **Instância default:** `ROMA_1` (hardcoded — ver seção 8).
- **Limite default:** 100 contatos.

### 6.2 checkWhatsAppNumbers

```typescript
export async function checkWhatsAppNumbers(params: {
  numbers: string[];
  instance?: string;
}): Promise<{
  success: boolean;
  results: Array<{ number: string; exists: boolean; jid: string | null }>;
  error?: string;
}>
```

- **Endpoint Evolution API:** `POST /chat/whatsappNumbers/{instance}`
- **Body enviado:** `{ numbers: [...] }` (números formatados via `formatarTelefone`)
- **Instância default:** `ROMA_1` (hardcoded).
- **Formato de saída:** Cada resultado indica se o número existe no WhatsApp e seu JID.

### 6.3 formatarTelefone

```typescript
export function formatarTelefone(telefone: string): string {
  let nums = telefone.replace(/\D/g, '');  // Remove tudo que não é dígito
  if (!nums.startsWith('55')) {
    nums = '55' + nums;                    // Adiciona código do Brasil
  }
  return nums;
}
```

- Remove caracteres não numéricos (parênteses, traços, espaços).
- Adiciona prefixo `55` (Brasil) se não estiver presente.
- **Não adiciona o 9 automaticamente** — números antigos (como 3416-5014) não possuem 9.

---

## 7. Variáveis de Ambiente

| Variável              | Obrigatória | Descrição                                             | Valor padrão                      |
|-----------------------|-------------|-------------------------------------------------------|-----------------------------------|
| `EVOLUTION_API_URL`   | Sim         | URL base do servidor Evolution API                    | `http://localhost:8082`          |
| `EVOLUTION_API_KEY`   | Sim         | Chave de autenticação da API                          | —                                |
| `EVOLUTION_INSTANCE`  | Não         | Nome da instância padrão (usado em outras funções)    | `ROMA_1`                         |

> **Atenção:** As funções `findContacts` e `checkWhatsAppNumbers` usam `ROMA_1`
> como default **hardcoded**, ignorando `EVOLUTION_INSTANCE`. Ver seção 8 para detalhes.

---

## 8. Armadilhas e Pontos de Atenção

### 8.1 Instância hardcoded como "ROMA_1"

As funções `findContacts()` e `checkWhatsAppNumbers()` contêm:

```typescript
// HARDCODE: instância correta do projeto (não usar EVOLUTION_INSTANCE que pode estar errado)
const instanceName = instance || 'ROMA_1';
```

Isso foi feito intencionalmente porque a variável `EVOLUTION_INSTANCE` pode conter
um valor incorreto no deploy atual. O comentário explica que a instância correta é
`ROMA_1`.

**Impacto:** Se outra instância precisar ser usada, o parâmetro `instance` deve ser
passado explicitamente (não basta alterar `EVOLUTION_INSTANCE` no `.env`).

**Débito técnico:** Idealmente, o valor deveria vir de uma tabela de configuração ou
ser unificado. Isso deve ser resolvido quando houver múltiplas instâncias WhatsApp.

### 8.2 Formato @lid vs @s.whatsapp.net

Os contatos podem retornar JIDs em dois formatos:

- **`5511999887766@s.whatsapp.net`** — formato padrão de números de telefone
- **`3E22AD6A8D21AE12C15F4C576ABE9E@lid`** — formato de ID interno do WhatsApp
  (usado para contatos que não foram encontrados pela agenda)

A função `extractPhone()` no componente e o `handleContatoSelecionado` no page
removem ambos os sufixos:

```typescript
const telefone = contact.remoteJid
  .replace("@s.whatsapp.net", "")
  .replace("@lid", "");
```

**Problema potencial:** Quando o JID é no formato `@lid`, o telefone resultante
será o hash interno (ex: `3E22AD6A8D21AE12C15F4C576ABE9E`), **não** um número
de telefone real. Isso pode causar falhas ao tentar enviar mensagens via
Evolution API posteriormente.

**Recomendação:** Antes de criar o atendimento, verificar se o contato possui
um `remoteJid` no formato `@s.whatsapp.net`. Se for `@lid`, o número real
não está disponível e o atendimento pode não funcionar corretamente.

### 8.3 pushName pode ser null

A Evolution API retorna `pushName` como `null` quando o contato não foi encontrado
na agenda local ou quando o nome não está disponível.

**Comportamento atual:**
- No modal: exibe "Sem nome" como fallback.
- Na criação do atendimento: usa `"Cliente"` como fallback.

```typescript
nome_cliente: contact.pushName || "Cliente",
```

### 8.4 Filtro de busca é client-side

A função `findContacts()` busca **todos** os contatos (limit 100 por padrão) e
filtra localmente:

```typescript
if (search) {
  const searchLower = search.toLowerCase();
  contacts = contacts.filter((c: any) =>
    c.pushName?.toLowerCase().includes(searchLower) ||
    c.remoteJid?.includes(search)
  );
}
```

Isso significa que:
- A busca é feita apenas em memória.
- A performance pode ser ruim com muitos contatos.
- A busca não encontra contatos pelo nome se o `pushName` for `null`.

### 8.5 Duplicação de formatação de telefone

A função `formatarTelefone` está duplicada em dois módulos:
- `lib/evolution-api.ts`
- `lib/botconversa.ts`

Ambas fazem a mesma coisa (remover não-dígitos + adicionar `55`), mas são cópias
independentes. Manutenção futura requer alteração em ambos os locais.

### 8.6 Polling e re-fetch

O `handleContatoSelecionado` faz duas requisições sequenciais:
1. `POST /api/atendimentos` para criar o atendimento.
2. `GET /api/atendimentos` para buscar a lista atualizada e localizar o novo atendimento.

Isso pode causar uma condição de corrida se a lista ainda não foi atualizada.
O código compensa fazendo `fetchAtendimentos(true)` (silencioso) antes de buscar
o atendimento específico.

---

## 9. Fluxo Completo (Sequence Diagram)

```
┌────────┐     ┌──────────┐     ┌─────────────┐     ┌─────────────┐     ┌────────────┐
│Operador│     │  Modal   │     │   API Route  │     │Evolution API│     │  Supabase  │
│        │     │WhatsApp  │     │/whatsapp/    │     │             │     │            │
│        │     │Contacts  │     │contacts      │     │             │     │            │
├────────┤     ├──────────┤     ├─────────────┤     ├─────────────┤     ├────────────┤
│Clica   │     │          │     │             │     │             │     │            │
│"Novo   ├────►│  open=   │     │             │     │             │     │            │
│Contato"│     │  true    │     │             │     │             │     │            │
│        │     │          │     │             │     │             │     │            │
│        │     │Carrega   │     │             │     │             │     │            │
│        │     │contatos  ├────►│ GET /api/   │     │             │     │            │
│        │     │(limit=100)│    │whatsapp/    │     │             │     │            │
│        │     │          │     │contacts     ├────►│POST /chat/  │     │            │
│        │     │          │     │             │◄────│findContacts │     │            │
│        │     │          │◄────│ { contacts }│     │             │     │            │
│        │     │Exibe     │     │             │     │             │     │            │
│        │     │lista     │     │             │     │             │     │            │
│        │     │          │     │             │     │             │     │            │
│        │     │Busca     │     │             │     │             │     │            │
│        │     │"João"    ├────►│ GET /api/   │     │             │     │            │
│        │     │(debounce │     │whatsapp/    │     │             │     │            │
│        │     │ 300ms)   │     │contacts?    ├────►│POST /chat/  │     │            │
│        │     │          │     │search=João  │◄────│findContacts │     │            │
│        │     │          │◄────│ { contacts }│     │             │     │            │
│        │     │          │     │             │     │             │     │            │
│Seleciona│    │          │     │             │     │             │     │            │
│"João    ├────│onSelect  │     │             │     │             │     │            │
│Silva"   │     │→ onClose │     │             │     │             │     │            │
│        │     │          │     │             │     │             │     │            │
│        │     │          │     │POST /api/   │     │             │     │            │
│        │     │          │     │atendimentos ├─────────────────────────►│            │
│        │     │          │     │             │     │             │     │ INSERT     │
│        │     │          │     │◄──────────────────────────────────────│ { id }     │
│        │     │          │     │             │     │             │     │            │
│        │     │          │     │GET /api/    │     │             │     │            │
│        │     │          │     │atendimentos ├─────────────────────────►│            │
│        │     │          │     │             │     │             │     │ SELECT     │
│        │     │          │     │◄──────────────────────────────────────│ [...]      │
│        │     │          │     │             │     │             │     │            │
│        │     │          │     │setAtendiment│     │             │     │            │
│        │     │          │     │oChat(novo)  │     │             │     │            │
│        │     │          │     │             │     │             │     │            │
└────────┘     └──────────┘     └─────────────┘     └─────────────┘     └────────────┘
```

---

## 10. Checklist de Testes

### 10.1 Funcionalidade Básica

- [ ] Botão "Novo Contato" aparece na barra lateral de atendimentos.
- [ ] Modal abre ao clicar no botão.
- [ ] Lista de contatos é carregada automaticamente ao abrir o modal.
- [ ] Fechar o modal (botão X ou clique fora) funciona corretamente.
- [ ] Fechar o modal limpa o estado (busca, lista, erros).

### 10.2 Busca

- [ ] Digitar no campo de busca filtra os contatos por nome.
- [ ] Digitar no campo de busca filtra os contatos por número.
- [ ] Busca tem debounce de 300ms (verificar com DevTools Network).
- [ ] Campo de busca mostra "Nenhum contato encontrado" quando não há resultados.
- [ ] Campo de busca mostra "Digite para buscar contatos" quando vazio e sem lista.

### 10.3 Exibição de Contatos

- [ ] Avatar do contato é exibido quando `profilePicUrl` está disponível.
- [ ] Ícone de "UserPlus" é exibido quando `profilePicUrl` é null.
- [ ] Nome do contato é exibido corretamente.
- [ ] "Sem nome" é exibido quando `pushName` é null.
- [ ] Badge "Salvo" aparece quando `isSaved` é true.
- [ ] Badge "Grupo" aparece quando `isGroup` é true.
- [ ] Número do telefone é exibido corretamente (sem sufixos @s.whatsapp.net ou @lid).
- [ ] Contador no footer mostra quantidade correta de contatos.

### 10.4 Seleção de Contato

- [ ] Ao clicar em um contato, o modal fecha.
- [ ] Um novo atendimento é criado no Supabase.
- [ ] O nome do contato é salvo como `nome_cliente` (ou "Cliente" se null).
- [ ] O telefone é extraído corretamente do `remoteJid`.
- [ ] O chat é aberto automaticamente com o novo atendimento.
- [ ] A lista lateral é atualizada silenciosamente.

### 10.5 Limites e Erros

- [ ] Requisição com mais de 500 contatos retorna erro 400.
- [ ] Requisição com mais de 20 números no check-number retorna erro 400.
- [ ] Erro de conexão com Evolution API exibe mensagem amigável.
- [ ] Erro de autenticação (API Key inválida) exibe mensagem correta.
- [ ] Lista de contatos vazia exibe mensagem apropriada.

### 10.6 Edge Cases

- [ ] Contato com JID no formato `@lid` não quebra a extração de telefone.
- [ ] Contato com `pushName: null` não causa erro de renderização.
- [ ] Contato com `profilePicUrl: null` não quebra a imagem.
- [ ] Selecionar o mesmo contato duas vezes cria dois atendimentos distintos.
- [ ] Busca com caracteres especiais (acentos, cedilha) funciona corretamente.

### 10.7 Performance

- [ ] Modal carrega em menos de 2 segundos com 100 contatos.
- [ ] Busca responde em menos de 500ms com debounce.
- [ ] Não há memory leak ao abrir/fechar modal múltiplas vezes.

---

## 11. Arquivos Relacionados

| Arquivo | Descrição |
|---------|-----------|
| `lib/evolution-api.ts` | Funções `findContacts`, `checkWhatsAppNumbers`, `formatarTelefone` |
| `app/api/whatsapp/contacts/route.ts` | API Route GET para busca de contatos |
| `app/api/whatsapp/check-number/route.ts` | API Route POST para verificação de números |
| `components/features/atendimento/buscar-contatos-whatsapp.tsx` | Componente modal |
| `app/(dashboard)/atendimento/page.tsx` | Página principal com `handleContatoSelecionado` |
| `lib/botconversa.ts` | Contém duplicata de `formatarTelefone` |

---

## 12. Próximos Passos

1. **Resolver instância hardcoded** — Criar configuração unificada ou tabela de config.
2. **Filtro server-side** — Implementar busca por nome na Evolution API (se suportado).
3. **Formato @lid** — Adicionar lógica para resolver número real a partir do LID.
4. **Paginação** — Implementar paginação para listas com mais de 100 contatos.
5. **Unificar formatarTelefone** — Remover duplicata entre `evolution-api.ts` e `botconversa.ts`.
6. **Cache** — Adicionar cache de contatos para evitar chamadas repetidas à API.
