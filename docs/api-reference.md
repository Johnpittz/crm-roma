# Referência da API — CRM ROMA

> Documentação gerada automaticamente a partir dos arquivos de rotas Next.js.
> Base URL: `/api`
> Autenticação: Header `Authorization: Bearer <token>` ou sessão Supabase (cookie).

---

## Índice

1. [Autenticação e Cadastro](#1-autenticação-e-cadastro)
2. [Atendimentos](#2-atendimentos)
3. [Mensagens de Atendimento](#3-mensagens-de-atendimento)
4. [Etiquetas de Atendimento](#4-etiquetas-de-atendimento)
5. [Sincronização de Mensagens](#5-sincronização-de-mensagens)
6. [Tarefas](#6-tarefas)
7. [Resumo de Tarefas](#7-resumo-de-tarefas)
8. [Clientes](#8-clientes)
9. [Vendedores](#9-vendedores)
10. [Equipes](#10-equipes)
11. [Vendas](#11-vendas)
12. [Produtos](#12-produtos)
13. [Filtros de Produtos](#13-filtros-de-produtos)
14. [Promoções](#14-promoções)
15. [Clientes de Promoções](#15-clientes-de-promoções)
16. [Oportunidades](#16-oportunidades)
17. [Notificações](#17-notificações)
18. [Leads](#18-leads)
19. [Distribuição de Leads](#19-distribuição-de-leads)
20. [Prospecção B2B](#20-prospecção-b2b)
21. [Envio de Mídia](#21-envio-de-mídia)
22. [Download de Mídia](#22-download-de-mídia)
23. [AI Sales](#23-ai-sales)
24. [Configuração AI Sales](#24-configuração-ai-sales)
25. [Teste AI Sales](#25-teste-ai-sales)
26. [Webhooks](#26-webhooks)
27. [Contatos WhatsApp](#27-contatos-whatsapp)
28. [Verificação de Números WhatsApp](#28-verificação-de-números-whatsapp)

---

## 1. Autenticação e Cadastro

### POST `/api/auth/cadastro`

Cria um novo usuário no sistema. Apenas administradores podem cadastrar.

**Rate Limit:** 5 requisições/minuto

**Permissões:** `diretor`, `admin`, `gerente_comercial`

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nome_completo` | string | ✅ | Nome completo do usuário |
| `email` | string | ✅ | E-mail do usuário |
| `senha` | string | ✅ | Senha (mínimo 6 caracteres) |
| `telefone` | string | ❌ | Telefone de contato |

**Resposta (200):**
```json
{
  "success": true,
  "message": "Conta criada com sucesso! Você já pode fazer login.",
  "user": {
    "id": "uuid",
    "email": "usuario@email.com",
    "nome_completo": "Nome Completo"
  }
}
```

**Erros:**
- `401` — Não autenticado
- `403` — Apenas administradores podem criar usuários
- `400` — Campos obrigatórios ausentes ou senha < 6 caracteres
- `429` — Muitas tentativas

---

## 2. Atendimentos

### GET `/api/atendimentos`

Lista atendimentos do vendedor logado. Gestores veem todos.

**Query Params:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `status` | string | Filtrar por status (ex: `aberto`, `fechado`) |

**Resposta (200):**
```json
{
  "atendimentos": [
    {
      "id": "uuid",
      "status": "aberto",
      "nome_cliente": "João Silva",
      "telefone_cliente": "5562999999999",
      "canal": "whatsapp",
      "ultima_mensagem": "Olá, tudo bem?",
      "ultima_mensagem_data": "2026-09-19T10:00:00Z",
      "nao_lido": true,
      "clientes": { "id": "uuid", "nome_razao_social": "João Silva" }
    }
  ]
}
```

---

### POST `/api/atendimentos`

Cria ou atualiza um atendimento (simulação ou webhook).

**Rate Limit:** 20 requisições/minuto

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `telefone_cliente` | string | ✅ | Telefone do cliente |
| `nome_cliente` | string | ❌ | Nome do cliente |
| `mensagem` | string | ❌ | Mensagem inicial |
| `canal` | string | ❌ | Canal (padrão: `whatsapp`) |

**Resposta (200):**
```json
{
  "success": true,
  "atendimento_id": "uuid",
  "updated": false,
  "cliente_encontrado": true
}
```

---

### PATCH `/api/atendimentos`

Fecha, transfere ou assume um atendimento.

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | ✅ | ID do atendimento |
| `status` | string | ❌ | Novo status |
| `vendedor_id` | string | ❌ | ID do vendedor (transferência) |
| `assumir` | boolean | ❌ | Assume atendimento não atribuído |
| `nao_lido` | boolean | ❌ | Marca como lido/não lido |

**Resposta (200):**
```json
{
  "success": true,
  "atendimento": { "id": "uuid", "status": "fechado", "..." : "..." }
}
```

**Erros:**
- `403` — Sem permissão para alterar este atendimento

---

## 3. Mensagens de Atendimento

### GET `/api/atendimentos/mensagens`

Lista mensagens de um atendimento.

**Query Params:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `atendimento_id` | string | ✅ | ID do atendimento |

**Resposta (200):**
```json
{
  "mensagens": [
    {
      "id": "uuid",
      "atendimento_id": "uuid",
      "remetente": "cliente",
      "conteudo": "Olá!",
      "enviada_por": null,
      "tipo_midia": null,
      "url_midia": null,
      "created_at": "2026-09-19T10:00:00Z"
    }
  ]
}
```

---

### POST `/api/atendimentos/mensagens`

Envia uma mensagem em um atendimento. Se o remetente for `vendedor`, a mensagem é enviada via WhatsApp (Evolution API).

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `atendimento_id` | string | ✅ | ID do atendimento |
| `conteudo` | string | ✅ | Conteúdo da mensagem |
| `remetente` | string | ❌ | `vendedor` ou `cliente` (padrão: `vendedor`) |
| `instance` | string | ❌ | Nome da instância WhatsApp |
| `media_url` | string | ❌ | URL da mídia |
| `media_type` | string | ❌ | Tipo da mídia |
| `file_name` | string | ❌ | Nome do arquivo |

**Resposta (200):**
```json
{
  "success": true,
  "mensagem": { "id": "uuid", "conteudo": "Olá!", "..." : "..." }
}
```

---

## 4. Etiquetas de Atendimento

### GET `/api/atendimentos/etiquetas`

Busca etiquetas de um atendimento, todas as etiquetas únicas, ou mapa completo.

**Query Params:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `atendimento_id` | string | ID do atendimento |
| `todas` | string (`true`) | Retorna todas as etiquetas únicas |
| `todos` | string (`true`) | Retorna mapa {atendimento_id: etiquetas[]} |

**Resposta (200) — por atendimento:**
```json
{
  "etiquetas": [
    { "id": "uuid", "atendimento_id": "uuid", "etiqueta": "urgente", "created_at": "..." }
  ]
}
```

**Resposta (200) — todas:**
```json
{ "etiquetas": ["urgente", "vip", "follow_up"] }
```

**Resposta (200) — mapa:**
```json
{ "mapa": { "uuid1": ["urgente"], "uuid2": ["vip", "follow_up"] } }
```

---

### POST `/api/atendimentos/etiquetas`

Adiciona uma etiqueta a um atendimento.

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `atendimento_id` | string | ✅ | UUID do atendimento |
| `etiqueta` | string | ✅ | Nome da etiqueta |

**Resposta (200):**
```json
{ "etiqueta": { "id": "uuid", "atendimento_id": "uuid", "etiqueta": "urgente" } }
```

**Erros:**
- `400` — atendimento_id não é UUID válido
- `23505` — Etiqueta já vinculada (resposta: `{"message": "Etiqueta já vinculada"}`)
- `503` — Tabela não existe (retorna SQL para criar)

---

### DELETE `/api/atendimentos/etiquetas`

Remove uma etiqueta de um atendimento.

**Query Params:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `atendimento_id` | string | ✅ | ID do atendimento |
| `etiqueta` | string | ✅ | Nome da etiqueta |

**Resposta (200):**
```json
{ "message": "Etiqueta removida" }
```

---

## 5. Sincronização de Mensagens

### GET `/api/atendimentos/sync`

Sincroniza mensagens do BotConversa que não foram registradas no CRM.

**Query Params:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `atendimento_id` | string | ✅ | ID do atendimento |

**Resposta (200):**
```json
{ "syncadas": 3 }
```

**Erros:**
- `400` — atendimento_id obrigatório
- `404` — Atendimento não encontrado

---

## 6. Tarefas

### GET `/api/tarefas`

Lista tarefas do vendedor logado.

**Query Params:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `data` | string (YYYY-MM-DD) | Filtrar por data de início |
| `coluna` | string | Filtrar por coluna kanban (`a_fazer`, `em_andamento`, `concluida`) |
| `cliente_nome` | string | Filtrar por nome do cliente |

**Resposta (200):**
```json
{
  "tarefas": [
    {
      "id": "uuid",
      "titulo": "Ligar para cliente",
      "tipo": "ligacao",
      "prioridade": "alta",
      "status": "pendente",
      "coluna_kanban": "a_fazer",
      "data_inicio": "2026-09-19",
      "hora_inicio": "10:00",
      "resultado": null,
      "clientes": { "id": "uuid", "nome_razao_social": "João" }
    }
  ]
}
```

---

### POST `/api/tarefas`

Cria uma nova tarefa.

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `titulo` | string | ✅ | Título da tarefa |
| `tipo` | string | ✅ | Tipo da tarefa |
| `cliente_id` | string | ❌ | ID do cliente |
| `cliente_nome` | string | ❌ | Nome do cliente |
| `descricao` | string | ❌ | Descrição |
| `prioridade` | string | ❌ | `alta`, `media`, `baixa` (padrão: `media`) |
| `coluna_kanban` | string | ❌ | Coluna kanban (padrão: `a_fazer`) |
| `data_inicio` | string | ❌ | Data de início (YYYY-MM-DD) |
| `hora_inicio` | string | ❌ | Hora de início (HH:MM) |
| `data_fim` | string | ❌ | Data de término |
| `hora_fim` | string | ❌ | Hora de término |
| `vendedor_id` | string | ❌ | ID do vendedor (se diferente do logado) |
| `valor_venda` | number | ❌ | Valor da venda |
| `resultado` | string | ❌ | Resultado da tarefa |
| `observacao_resultado` | string | ❌ | Observação do resultado |
| `origem_lead` | string | ❌ | Origem do lead |

**Resposta (200):**
```json
{ "success": true, "tarefa": { "id": "uuid", "..." : "..." } }
```

**Erros:**
- `403` — Sem permissão para criar tarefa para este vendedor

---

### PATCH `/api/tarefas`

Atualiza uma tarefa (status, coluna, ordem, resultado, etc.).

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | ✅ | ID da tarefa |
| `titulo` | string | ❌ | Título |
| `descricao` | string | ❌ | Descrição |
| `prioridade` | string | ❌ | Prioridade |
| `coluna_kanban` | string | ❌ | Coluna kanban |
| `ordem` | number | ❌ | Ordem na coluna |
| `status` | string | ❌ | Status |
| `resultado` | string | ❌ | Resultado |
| `observacao_resultado` | string | ❌ | Observação do resultado |
| `valor_venda` | number | ❌ | Valor da venda |
| `cliente_nome` | string | ❌ | Nome do cliente |
| `data_fim` | string | ❌ | Data de término |
| `hora_fim` | string | ❌ | Hora de término |

**Resposta (200):**
```json
{ "success": true, "tarefa": { "id": "uuid", "..." : "..." } }
```

---

### DELETE `/api/tarefas`

Exclui uma tarefa.

**Query Params:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | ✅ | ID da tarefa |

**Resposta (200):**
```json
{ "success": true }
```

**Erros:**
- `403` — Sem permissão para excluir esta tarefa

---

## 7. Resumo de Tarefas

### GET `/api/tarefas/resumo`

Retorna métricas agregadas de tarefas e vendas para o período informado.

**Query Params:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `periodo` | string | `dia`, `mes`, `ano`, `personalizado` (padrão: `dia`) |
| `data` | string (YYYY-MM-DD) | Data de referência (padrão: hoje) |
| `inicio` | string (YYYY-MM-DD) | Data início (se período = `personalizado`) |
| `fim` | string (YYYY-MM-DD) | Data fim (se período = `personalizado`) |
| `modo` | string | `cliente` — retorna tarefas ativas agrupadas por cliente |

**Resposta (200):**
```json
{
  "periodo": "mes",
  "data_inicio": "2026-09-01T00:00:00.000Z",
  "data_fim": "2026-09-30T23:59:59.999Z",
  "total_vendas": 50000,
  "quantidade_vendas": 25,
  "ticket_medio": 2000,
  "total_tarefas": 100,
  "tarefas_por_resultado": {
    "sucesso": 25,
    "insucesso": 10,
    "remarcado": 5,
    "sem_contato": 3,
    "follow_up_necessario": 7,
    "pendente": 50
  },
  "vendas_por_periodo": [
    { "label": "01/09", "valor": 5000, "quantidade": 3 }
  ],
  "meta": 50000,
  "percentual_meta": 100
}
```

---

## 8. Clientes

### GET `/api/clientes`

Lista os clientes **do escopo do logado**: vendedor só os próprios; `gerente_comercial` a carteira da **sua equipe** (a carteira é dividida entre os gestores); direção (`diretor`/`admin`) a carteira toda. O escopo é resolvido no servidor a partir do cargo (`lib/carteira.ts`).

**Query params:** `limite` (padrão 200, máx 1000) · `busca` (nome) · `status`

**Resposta (200):**
```json
{ "clientes": [], "total": 150, "escopo": "proprio", "limite": 200 }
```

`total` é o tamanho do escopo (ignora o `limite`); `escopo` é `"proprio"`, `"equipe"` ou `"todos"`.

---

### POST `/api/clientes`

Cria um novo cliente. Usuários de demonstração não podem cadastrar.

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nome_razao_social` | string | ✅ | Nome ou razão social |
| `cpf_cnpj` | string | ❌ | CPF ou CNPJ |
| `telefone` | string | ❌ | Telefone |
| `email` | string | ❌ | E-mail |
| `cidade` | string | ❌ | Cidade |
| `estado` | string | ❌ | Estado (UF) |
| `status` | string | ❌ | Status do cliente |
| `tipo` | string | ❌ | Tipo do cliente |

**Resposta (200):**
```json
{ "success": true }
```

**Erros:**
- `403` — Usuários de demonstração não podem cadastrar clientes

---

## 9. Vendedores

### GET `/api/vendedores`

Lista todos os vendedores do sistema. Apenas gestores.

**Permissões:** `diretor`, `admin`, `gerente_comercial`

**Resposta (200):**
```json
{
  "vendedores": [
    {
      "id": "uuid",
      "nome_completo": "Maria Silva",
      "email": "maria@email.com",
      "cargo": "vendedor",
      "telefone": "5562999999999"
    }
  ]
}
```

**Cache:** `Cache-Control: private, max-age=300, stale-while-revalidate=600`

---

### POST `/api/vendedores`

Cadastra um novo vendedor. Apenas gerência.

**Permissões:** `diretor`, `gerente_comercial`, `admin`

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nome_completo` | string | ✅ | Nome completo |
| `email` | string | ✅ | E-mail |
| `senha` | string | ✅ | Senha |
| `cargo` | string | ❌ | Cargo (padrão: `vendedor`) |
| `telefone` | string | ❌ | Telefone |

**Resposta (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "novo@email.com",
    "nome_completo": "Novo Vendedor",
    "cargo": "vendedor"
  }
}
```

---

## 10. Equipes

### GET `/api/equipes`

Retorna a equipe de vendedores do gestor logado, com estatísticas individuais e gerais.

**Resposta (200):**
```json
{
  "gestor": {
    "id": "uuid",
    "nome": "Gerente Silva",
    "cargo": "gerente_comercial",
    "is_diretoria": false
  },
  "vendedores": [
    {
      "id": "uuid",
      "nome_completo": "Maria Silva",
      "email": "maria@email.com",
      "cargo": "vendedor",
      "ativo": true,
      "stats": {
        "total_clientes": 50,
        "clientes_ativos": 40,
        "total_vendas": 120,
        "faturamento": 250000
      }
    }
  ],
  "stats": {
    "total_vendedores": 5,
    "total_clientes": 250,
    "clientes_ativos": 200,
    "total_vendas": 600,
    "faturamento_total": 1200000
  }
}
```

---

## 11. Vendas

### GET `/api/vendas`

Lista vendas do período. Vendedores veem apenas suas vendas.

**Query Params:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `q` | string | Busca por nome do cliente |
| `status` | string | Filtrar por status (padrão: `todos`) |
| `periodo` | string | `semana`, `mes`, `ano` (padrão: `mes`) |
| `limite` | number | Limite de resultados (máx: 500, padrão: 100) |

**Resposta (200):**
```json
{
  "vendas": [
    {
      "id": "uuid",
      "numero_pedido": "V001",
      "data_venda": "2026-09-19",
      "valor_total": 1500,
      "valor_final": 1400,
      "status": "confirmada",
      "clientes": { "nome_razao_social": "João Silva" }
    }
  ],
  "stats": {
    "total_vendas": 25,
    "total_faturado": 50000,
    "ticket_medio": 2000
  },
  "count": 25
}
```

---

### POST `/api/vendas`

Cria uma nova venda com itens.

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `cliente_id` | string | ✅ | ID do cliente |
| `data_venda` | string | ✅ | Data da venda (YYYY-MM-DD) |
| `valor_total` | number | ✅ | Valor total |
| `valor_final` | number | ✅ | Valor final (após descontos) |
| `canal_id` | string | ❌ | ID do canal de venda |
| `valor_desconto` | number | ❌ | Valor do desconto (padrão: 0) |
| `valor_frete` | number | ❌ | Valor do frete (padrão: 0) |
| `status` | string | ❌ | Status (padrão: `confirmada`) |
| `forma_pagamento` | string | ❌ | Forma de pagamento |
| `prazo_pagamento` | string | ❌ | Prazo de pagamento |
| `itens` | array | ❌ | Itens da venda |

**Formato dos itens:**
```json
{
  "produto_id": "uuid",
  "quantidade": 2,
  "valor_unitario": 100,
  "valor_total": 200,
  "desconto_percentual": 10
}
```

**Resposta (200):**
```json
{ "success": true, "venda": { "id": "uuid", "numero_pedido": "V002", "..." : "..." } }
```

---

## 12. Produtos

### GET `/api/produtos`

Lista produtos com filtros e paginação.

**Query Params:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `busca` | string | Busca por nome, código ERP ou SKU |
| `status` | string | Filtrar por status do produto |
| `categoria` | string | Filtrar por categoria |
| `marca` | string | Filtrar por marca |
| `limite` | number | Limite (padrão: 100) |
| `offset` | number | Offset para paginação (padrão: 0) |

**Resposta (200):**
```json
{
  "produtos": [
    {
      "id": "uuid",
      "nome": "Produto ABC",
      "codigo_erp": "00123",
      "sku": "ABC-001",
      "preco_venda": 150,
      "marca": "Marca X",
      "categoria_nome": "Categoria Y",
      "status_produto": "ativo"
    }
  ],
  "total": 500
}
```

---

## 13. Filtros de Produtos

### GET `/api/produtos/filtros`

Retorna listas de marcas, categorias e status disponíveis para filtros.

**Resposta (200):**
```json
{
  "marcas": ["Marca A", "Marca B", "Marca C"],
  "categorias": ["Categoria X", "Categoria Y"],
  "status": ["ativo", "inativo", "descontinuado"]
}
```

---

## 14. Promoções

### GET `/api/promocoes`

Lista promoções com dados do produto associado.

**Query Params:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `status` | string | Filtrar por status (padrão: todas) |

**Resposta (200):**
```json
{
  "promocoes": [
    {
      "id": "uuid",
      "titulo": "Promoção de Verão",
      "descricao": "Desconto especial",
      "tipo_promocao": "desconto_percentual",
      "valor": 15,
      "data_inicio": "2026-09-01",
      "data_fim": "2026-09-30",
      "status": "ativa",
      "total_clientes": 10,
      "produto": {
        "id": "uuid",
        "nome": "Produto ABC",
        "codigo_erp": "00123",
        "preco_venda": 150,
        "marca": "Marca X",
        "categoria_nome": "Categoria Y"
      }
    }
  ]
}
```

---

### POST `/api/promocoes`

Cria uma nova promoção.

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `titulo` | string | ✅ | Título da promoção |
| `produto_id` | string | ✅ | ID do produto |
| `tipo_promocao` | string | ✅ | Tipo da promoção |
| `data_fim` | string | ✅ | Data de término |
| `descricao` | string | ❌ | Descrição |
| `valor` | number | ❌ | Valor do desconto (padrão: 0) |
| `data_inicio` | string | ❌ | Data de início (padrão: hoje) |

**Resposta (200):**
```json
{ "success": true, "promocao": { "id": "uuid", "..." : "..." } }
```

---

### PATCH `/api/promocoes`

Atualiza o status de uma promoção.

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | ✅ | ID da promoção |
| `status` | string | ✅ | Novo status |

**Resposta (200):**
```json
{ "success": true, "promocao": { "id": "uuid", "status": "inativa" } }
```

---

## 15. Clientes de Promoções

### GET `/api/promocoes/clientes`

Retorna clientes que compraram um determinado produto (agregado).

**Query Params:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `produto_id` | string | ✅ | ID do produto |

**Resposta (200):**
```json
{
  "clientes": [
    {
      "cliente_id": "uuid",
      "nome_razao_social": "João Silva",
      "telefone": "5562999999999",
      "celular": "5562988888888",
      "email": "joao@email.com",
      "cidade": "Goiânia",
      "estado": "GO",
      "total_compras": 5,
      "total_itens": 10,
      "valor_total_gasto": 5000,
      "ultima_compra": "2026-09-15",
      "primeira_compra": "2026-01-10"
    }
  ],
  "total": 1
}
```

---

## 16. Oportunidades

### GET `/api/oportunidades`

Lista oportunidades do vendedor logado.

**Query Params:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `status` | string | Filtrar por status (padrão: `aberta`) |
| `gerar_auto` | string (`true`) | Gera oportunidades de churn automaticamente |

**Resposta (200):**
```json
{
  "oportunidades": [
    {
      "id": "uuid",
      "vendedor_id": "uuid",
      "cliente_id": "uuid",
      "tipo_origem": "manual",
      "motivo_geracao": "Sem compra há 90 dias",
      "valor_estimado": 5000,
      "probabilidade": 50,
      "estagio": "prospeccao",
      "status": "aberta",
      "clientes": { "id": "uuid", "nome_razao_social": "João" }
    }
  ]
}
```

---

### POST `/api/oportunidades`

Cria uma oportunidade manualmente.

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `cliente_id` | string | ✅ | ID do cliente |
| `motivo_geracao` | string | ✅ | Motivo da geração |
| `valor_estimado` | number | ❌ | Valor estimado |
| `probabilidade` | number | ❌ | Probabilidade de fechamento (padrão: 50) |
| `data_previsao_fechamento` | string | ❌ | Previsão de fechamento |
| `contexto` | string | ❌ | Contexto adicional |

**Resposta (200):**
```json
{ "success": true, "oportunidade": { "id": "uuid", "..." : "..." } }
```

---

### PATCH `/api/oportunidades`

Converte uma oportunidade para ganha, perdida ou arquivada.

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | ✅ | ID da oportunidade |
| `status` | string | ✅ | `ganha`, `perdida`, `arquivada` |
| `motivo_perda` | string | ❌ | Motivo da perda (se status = `perdida`) |
| `venda_id` | string | ❌ | ID da venda associada (se status = `ganha`) |

**Resposta (200):**
```json
{ "success": true, "oportunidade": { "id": "uuid", "status": "ganha" } }
```

**Erros:**
- `403` — Oportunidade não encontrada ou sem permissão

---

## 17. Notificações

### GET `/api/notificacoes`

Lista notificações do usuário logado.

**Query Params:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `nao_lidas` | string (`true`) | Filtra apenas não lidas |

**Resposta (200):**
```json
{
  "notificacoes": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "tipo": "meta_atingida",
      "titulo": "🎉 Meta Atingida!",
      "mensagem": "Parabéns! Você atingiu 100% da meta mensal.",
      "lida": false,
      "created_at": "2026-09-19T10:00:00Z"
    }
  ],
  "naoLidas": 3
}
```

---

### PATCH `/api/notificacoes`

Marca notificações como lidas.

**Body (JSON):**
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | string | ID da notificação |
| `todas` | boolean | Marca todas como lidas |

**Resposta (200):**
```json
{ "success": true, "todas": true }
// ou
{ "success": true, "notificacao": { "id": "uuid", "lida": true } }
```

---

### DELETE `/api/notificacoes`

Exclui notificação(ões).

**Query Params:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `id` | string | ID da notificação |
| `todas` | string (`true`) | Exclui todas |

**Resposta (200):**
```json
{ "success": true, "todas": true }
// ou
{ "success": true }
```

---

## 18. Leads

### GET `/api/leads`

Lista leads com filtros. Vendedores veem apenas seus leads. Gestores veem leads da equipe.

**Query Params:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `status` | string | Filtrar por status |
| `origem` | string | Filtrar por origem |
| `busca` | string | Busca por razão social ou CNPJ |
| `vendedor_id` | string | Filtrar por vendedor |
| `data_inicio` | string | Data início (YYYY-MM-DD) |
| `data_fim` | string | Data fim (YYYY-MM-DD) |
| `limit` | number | Limite (máx: 200, padrão: 100) |

**Resposta (200):**
```json
{
  "leads": [
    {
      "id": "uuid",
      "cnpj": "12345678000190",
      "razao_social": "Empresa XYZ",
      "nome_fantasia": "XYZ",
      "telefone": "5562999999999",
      "email": "contato@xyz.com",
      "cidade": "Goiânia",
      "estado": "GO",
      "status": "novo",
      "origem": "prospeccao_b2b",
      "vendedor": { "id": "uuid", "nome_completo": "Maria Silva" },
      "created_at": "2026-09-19T10:00:00Z"
    }
  ],
  "total": 50
}
```

---

### PATCH `/api/leads`

Atualiza um lead (atribuir vendedor, mudar status, observações).

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | ✅ | ID do lead |
| `vendedor_id` | string | ❌ | ID do vendedor (apenas gestores) |
| `status` | string | ❌ | Novo status |
| `observacoes` | string | ❌ | Observações |

**Permissões:**
- Gestores (`diretor`, `admin`, `gerente_comercial`): podem atribuir vendedor
- Vendedores: só podem editar status e observações dos seus leads

**Resposta (200):**
```json
{ "success": true, "lead": { "id": "uuid", "status": "em_atendimento", "..." : "..." } }
```

---

## 19. Distribuição de Leads

### POST `/api/leads/distribuir`

Distribui leads não atribuídos em round-robin para vendedores.

**Permissões:** Apenas gestores. Usuários de demonstração não podem distribuir.

**Body (JSON):**
| Campo | Tipo | Descrição |
|---|---|---|
| `quantidade_por_vendedor` | number | Leads por vendedor (1-50, padrão: 5) |
| `preview` | boolean | Se `true`, retorna preview sem executar |

**Resposta (200) — preview:**
```json
{
  "preview": true,
  "quantidade_por_vendedor": 5,
  "total_leads_disponiveis": 100,
  "total_a_distribuir": 25,
  "sobrarao": 75,
  "vendedores": [
    {
      "vendedor": { "id": "uuid", "nome_completo": "Maria" },
      "quantidade": 5,
      "leads": [...]
    }
  ]
}
```

**Resposta (200) — execução:**
```json
{
  "preview": false,
  "success": true,
  "quantidade_por_vendedor": 5,
  "total_distribuido": 25,
  "erros": 0,
  "vendedores": [
    { "vendedor": { "id": "uuid", "nome_completo": "Maria" }, "quantidade": 5 }
  ]
}
```

---

## 20. Prospecção B2B

### GET `/api/prospeccao`

Busca empresas para prospecção em APIs externas (CNPJ Aberto ou CNPJota).

**Rate Limit:** 30 consultas/minuto

**Query Params:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `cnae` | string | ✅ | Código CNAE |
| `uf` | string | ❌ | UF (se omitido, busca em todo o Brasil) |
| `cidade` | string | ❌ | Cidade |
| `limite` | number | ❌ | Limite (máx: 100, padrão: 50) |

**Resposta (200):**
```json
{
  "empresas": [
    {
      "cnpj": "12345678000190",
      "razao_social": "Empresa XYZ Ltda",
      "nome_fantasia": "XYZ",
      "telefone": "5562999999999",
      "email": "contato@xyz.com",
      "logradouro": "Rua A",
      "numero": "123",
      "cidade": "Goiânia",
      "estado": "GO",
      "cnae_principal": "4751201",
      "cnae_principal_descricao": "Comércio varejista de artigos de informática",
      "porte": "ME",
      "situacao_cadastral": "Ativa"
    }
  ],
  "fonte": "cnpjaberto",
  "total": 50
}
```

---

### POST `/api/prospeccao`

Importa empresas selecionadas para o CRM como leads.

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `empresas` | array | ✅ | Array de objetos `EmpresaProspeccao` |
| `vendedor_id` | string | ❌ | ID do vendedor (apenas diretoria) |
| `cnae_filtro` | string | ❌ | CNAE usado na busca |
| `uf_filtro` | string | ❌ | UF usada na busca |
| `cidade_filtro` | string | ❌ | Cidade usada na busca |

**Resposta (200):**
```json
{
  "success": true,
  "resultados": {
    "importados": 45,
    "duplicados": 3,
    "erros": 2,
    "leads_ids": ["uuid1", "uuid2", "..."]
  }
}
```

---

## 21. Envio de Mídia

> **Atualizado (migração WAHA):** o envio interno usa agora `lib/waha.ts` (`enviarMidia`/`enviarAudio` — WAHA `sendImage/sendFile/sendVideo/sendVoice/sendSticker`), incluindo `sticker`. Contrato da rota inalterado. Ver `docs/plano-implementacao-waha.md`.

### POST `/api/send/media`

Envia mídia (imagem, áudio, vídeo, sticker, documento) via WhatsApp.

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `number` | string | ✅ | Número de destino |
| `media` | string | ✅ | Mídia em base64 |
| `mediatype` | string | ❌ | Tipo: `image`, `audio`, `video`, `sticker` |
| `mimetype` | string | ❌ | MIME type |
| `fileName` | string | ❌ | Nome do arquivo |
| `instance` | string | ❌ | Instância WhatsApp |

**Resposta (200):**
```json
{
  "success": true,
  "message_id": "whatsapp_msg_id",
  "media_url": "https://storage.example.com/media/..."
}
```

---

## 22. Download de Mídia

### GET `/api/media-download`

Baixa e decripta mídia do WhatsApp via Evolution API. Suporta cache em memória (1 hora).

**Query Params:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `msg_id` | string | ✅ | whatsapp_message_id ou UUID da mensagem |
| `type` | string | ❌ | Dica de tipo: `audio`, `image`, `video` (padrão: `audio`) |

**Resposta:** Retorna o binário da mídia com o Content-Type apropriado.

**Headers de resposta:**
```
Content-Type: audio/ogg
Cache-Control: public, max-age=3600
Content-Length: 12345
```

**Erros:**
- `400` — msg_id obrigatório
- `404` — Mensagem não encontrada
- `502` — Falha ao buscar mídia do WhatsApp

---

## 23. AI Sales

### POST `/api/ai-sales`

Gera resposta automática do AI Sales (Gemini) para um atendimento.

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `telefone` | string | ✅ | Telefone do cliente |
| `instance` | string | ❌ | Instância WhatsApp |

**Resposta (200):**
```json
{
  "resposta": "Olá! Vi que você tem interesse no nosso produto...",
  "criarTarefa": true,
  "tarefa": {
    "titulo": "Oportunidade: João Silva",
    "descricao": "Cliente demonstrou interesse...",
    "prioridade": "media",
    "cliente_nome": "João Silva"
  }
}
```

**Erros:**
- `500` — GEMINI_API_KEY não configurada
- `404` — Atendimento não encontrado

---

## 24. Configuração AI Sales

### GET `/api/ai-sales/config`

Retorna status do bot AI Sales (ligado/desligado).

**Resposta (200):**
```json
{ "enabled": true }
```

---

### PATCH `/api/ai-sales/config`

Liga ou desliga o bot AI Sales. Apenas gestores.

**Permissões:** `diretor`, `admin`, `gerente_comercial`

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `enabled` | boolean | ✅ | `true` para ligar, `false` para desligar |

**Resposta (200):**
```json
{ "enabled": false }
```

---

## 25. Teste AI Sales

### GET `/api/ai-sales/test`

Teste manual que verifica cada etapa do pipeline AI Sales.

**Query Params:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `telefone` | string | Telefone para teste (padrão: `556234165027`) |

**Resposta (200):**
```json
{
  "logs": [
    "1. GEMINI_API_KEY: PRESENTE (AIzaSy...)",
    "2. EVOLUTION_API_URL: http://localhost:8082",
    "3. EVOLUTION_API_KEY: PRESENTE (e3186c32...)",
    "4. Gemini API test: 200 - \"OK\"",
    "5. Evolution API connectivity: 200"
  ],
  "telefone": "556234165027"
}
```

---

## 26. Webhooks

### POST `/api/webhooks/waha`

Webhook **ativo** para receber mensagens do WhatsApp via **WAHA** (migração — `docs/plano-implementacao-waha.md`). Eventos: `message`, `message.ack` (→ `ack_status` dos checkmarks), `session.status`. Token opcional: header `X-Webhook-Token` = env `WAHA_WEBHOOK_TOKEN`. Ignora grupos; mídia chega pronta via `media.url` (sem decrypt).

### POST `/api/webhooks/evolution`

> **@deprecated (legado):** mantido apenas como rollback da migração WAHA.

Webhook para receber mensagens do WhatsApp via **Evolution API**.

**Rate Limit:** 60 webhooks/minuto por IP

**Payload:** Formato da Evolution API (`messages.upsert`, `connection.update`)

**Processamento:**
1. Valida rate limit
2. Extrai dados do payload (telefone, mensagem, mídia)
3. Ignora mensagens de grupo (`@g.us`)
4. Verifica duplicatas (dedup por `whatsapp_message_id`)
5. Faz upload de mídia base64 para Supabase Storage
6. Busca/atualiza ou cria atendimento
7. Insere mensagem no chat
8. Dispara AI Sales (apenas para mensagens de texto do cliente)

**Resposta (200):**
```json
{ "success": true, "atendimento_id": "uuid", "action": "created" }
// ou
{ "success": true, "atendimento_id": "uuid", "action": "updated" }
// ou
{ "success": true, "action": "dedup_skipped" }
// ou
{ "success": true, "action": "ignored_group" }
```

---

### POST `/api/webhooks/whatsapp`

Webhook para receber mensagens do WhatsApp via **BotConversa**.

**Rate Limit:** 60 webhooks/minuto

**Payload:** Formatos flexíveis do BotConversa:
- `{ phone, message, first_name }`
- `{ data: { phone, message } }`
- `{ event, payload: { phone, message } }`
- `{ from, body, pushName }`

**Processamento:**
1. Valida rate limit
2. Extrai telefone, mensagem, áudio do payload
3. Busca cliente pelo telefone
4. Busca ou cria atendimento
5. Insere mensagem (texto ou referência a áudio)

**Resposta (200):**
```json
{ "success": true, "atendimento_id": "uuid", "action": "created" }
// ou
{ "success": true, "atendimento_id": "uuid", "action": "updated" }
```

---

### POST `/api/webhooks/millennium`

Webhook para receber eventos do **Millennium** (ERP integrado).

**Rate Limit:** 60 webhooks/minuto

**Autenticação:** Header `X-Millennium-Secret` deve ser igual a `MILLENNIUM_WEBHOOK_SECRET`

**Eventos suportados:**
- `cliente.novo` / `cliente.atualizado` — Cria ou atualiza cliente
- `venda.nova` / `venda.finalizada` — Processa venda e atualiza ranking
- `campanha.nova` — Cria ou atualiza campanha

**Payload:**
```json
{
  "evento": "venda.nova",
  "data": {
    "numero": "001",
    "cod_cli": "C001",
    "cod_vend": "V001",
    "vlr_total": "1500.00",
    "vlr_desconto": "0.00",
    "canal_venda": "LF",
    "dt_emissao": "2026-09-19",
    "itens": [
      { "cod_prod": "P001", "qtd": "2", "vlr_unit": "750.00", "vlr_total": "1500.00" }
    ]
  }
}
```

**Resposta (200):**
```json
{ "success": true, "message": "Evento processado com sucesso" }
```

**Erros:**
- `401` — Não autorizado (secret inválido)
- `500` — Webhook secret não configurado

---

## 27. Contatos WhatsApp

### GET `/api/whatsapp/contacts`

Lista contatos da instância WhatsApp via Evolution API. Busca contatos na agenda e contatos de grupos conectados à instância.

**Query Params:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `search` | string | ❌ | Busca por nome (pushName) ou número (remoteJid) |
| `limit` | number | ❌ | Limite de resultados (padrão: 100, máx: 500) |
| `instance` | string | ❌ | Nome da instância WhatsApp (padrão: `ROMA_1`) |

**Exemplo de requisição:**
```
GET /api/whatsapp/contacts?search=João&limit=20
```

**Resposta (200):**
```json
{
  "success": true,
  "contacts": [
    {
      "id": "3EB0A1B2C3D4E5F6",
      "remoteJid": "5562999999999@s.whatsapp.net",
      "pushName": "João Silva",
      "profilePicUrl": "https://pps.whatsapp.net/...",
      "isSaved": true,
      "isGroup": false,
      "type": "contact"
    }
  ],
  "total": 5
}
```

**Erros:**
- `400` — Limite excedido (máx. 500)
- `500` — Erro ao buscar contatos ou API Key não configurada

---

## 28. Verificação de Números WhatsApp

### POST `/api/whatsapp/check-number`

Verifica se uma lista de números de telefone existem no WhatsApp. Útil para validar contatos antes de iniciar uma conversa.

**Body (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `numbers` | string[] | ✅ | Lista de números de telefone (máx. 20) |
| `instance` | string | ❌ | Nome da instância WhatsApp (padrão: `ROMA_1`) |

**Exemplo de requisição:**
```json
{
  "numbers": ["5562999999999", "5562888888888"],
  "instance": "ROMA_1"
}
```

**Resposta (200):**
```json
{
  "success": true,
  "results": [
    {
      "number": "5562999999999",
      "exists": true,
      "jid": "5562999999999@s.whatsapp.net"
    },
    {
      "number": "5562888888888",
      "exists": false,
      "jid": null
    }
  ]
}
```

**Erros:**
- `400` — Campo `numbers` ausente ou não é array; mais de 20 números
- `500` — Erro ao verificar números ou API Key não configurada

---

## Notas Gerais

### Cargos e Permissões

| Cargo | Descrição | Permissões |
|---|---|---|
| `admin` | Administrador | Acesso total |
| `diretor` | Diretor | Acesso total |
| `gerente_comercial` | Gerente Comercial | Gestão de equipe, leads, promoções |
| `vendedor` | Vendedor | Acesso aos próprios dados |
| `demonstracao` | Demonstração | Acesso limitado (não cadastra clientes, não distribui leads) |

### Autenticação

Todas as rotas exigem autenticação via:
- Header `Authorization: Bearer <token>` (token JWT do Supabase)
- Ou sessão via cookie (quando acessado pelo frontend Next.js)

### Supabase

O projeto utiliza dois clientes Supabase:
- **Anon Client** — com RLS (Row Level Security) ativo para operações do usuário
- **Service Role Client** — com bypass de RLS para operações administrativas e webhooks

### Webhooks

Os webhooks não exigem autenticação do usuário (exceto Millennium e token opcional `WAHA_WEBHOOK_TOKEN`). Eles são chamados por serviços externos:
- **WAHA** → `POST /api/webhooks/waha` — **principal**: eventos `message.any` (enviadas + recebidas), `message.ack`, `session.status`
- **BotConversa** → WhatsApp via BotConversa
- **Evolution API** → apenas legado/rollback (webhook `evolution` mantido)
- **Millennium** → ERP integrado (requer secret no header)
