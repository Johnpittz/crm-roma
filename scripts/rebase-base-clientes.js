/**
 * REBASE da base de clientes + organograma de vendedores
 *
 * Uso: node scripts/rebase-base-clientes.js <fase>
 *   fase 1: backup   - exporta JSON de todas as tabelas afetadas
 *   fase 2: wipe     - apaga dependentes (tarefas, leads, venda_itens, vendas,
 *                      atendimentos) e por fim todos os clientes
 *   fase 3: perfis   - organograma novo (Jackson gestor, Ellen/Dara criados,
 *                      equipe de Murilo, Gabriel/Keila/ecommerce desativados)
 *   fase 4: import   - importa base_clientes/*.xls mapeando cada planilha ao vendedor
 *   fase 5: verify   - contagens finais vs esperado
 *
 * Backups em: backups/rebase-2026-09-23/<tabela>.json
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const ENV_PATH = path.join(__dirname, '..', '.env.local');
const BACKUP_DIR = path.join(__dirname, '..', 'backups', 'rebase-2026-09-23');
const BASE_DIR = path.join(__dirname, '..', 'base_clientes');

function loadEnv() {
  const content = fs.readFileSync(ENV_PATH, 'utf-8');
  for (const line of content.split('\n')) {
    if (line.includes('=') && !line.startsWith('#')) {
      const [key, ...rest] = line.split('=');
      if (key && rest.length > 0) {
        process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}
loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Tabelas com dados de teste que dependem (direta ou indiretamente) de clientes
const TABELAS_BACKUP = [
  'profiles',
  'clientes',
  'vendas',
  'venda_itens',
  'atendimentos',
  'atendimento_mensagens',
  'atendimento_etiquetas',
  'leads',
  'tarefas',
  'oportunidades',
];

// Ordem de exclusão: filhos antes de clientes
const ORDEM_WIPE = ['tarefas', 'leads', 'venda_itens', 'vendas', 'atendimentos', 'clientes'];

async function fetchAll(tabela) {
  const todos = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase.from(tabela).select('*').range(from, from + pageSize - 1);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    todos.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return todos;
}

async function faseBackup() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const resumo = {};
  for (const t of TABELAS_BACKUP) {
    try {
      const rows = await fetchAll(t);
      fs.writeFileSync(path.join(BACKUP_DIR, `${t}.json`), JSON.stringify(rows, null, 1));
      resumo[t] = rows.length;
      console.log(`  ✅ ${t}: ${rows.length} linhas`);
    } catch (e) {
      resumo[t] = `ERRO: ${e.message}`;
      console.log(`  ⚠️  ${t}: ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(BACKUP_DIR, 'resumo-backup.json'), JSON.stringify(resumo, null, 2));
  console.log(`\nBackups salvos em ${BACKUP_DIR}`);
}

async function deletePorIds(tabela, ids) {
  let ok = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const lote = ids.slice(i, i + 500);
    const { error } = await supabase.from(tabela).delete().in('id', lote);
    if (error) throw new Error(`${tabela} (lote ${i}): ${error.message}`);
    ok += lote.length;
  }
  return ok;
}

async function faseWipe() {
  for (const t of ORDEM_WIPE) {
    try {
      const rows = await fetchAll(t);
      if (rows.length === 0) {
        console.log(`  ✅ ${t}: já vazia`);
        continue;
      }
      const n = await deletePorIds(t, rows.map(r => r.id));
      console.log(`  ✅ ${t}: ${n} linhas apagadas`);
    } catch (e) {
      console.log(`  ❌ ${t}: ${e.message}`);
      process.exit(1);
    }
  }
  const { count } = await supabase.from('clientes').select('*', { count: 'exact', head: true });
  console.log(`\nClientes restantes: ${count}`);
}

// ---------- FASE 3: perfis / organograma ----------

const ORGANIGRAMA = {
  criar: [
    { nome: 'Ellen', email: 'ellen@romagyn.com.br', gestor: 'Murilo' },
    { nome: 'Dara', email: 'dara@romagyn.com.br', gestor: 'Murilo' },
  ],
  gestores: [
    { nome: 'Murilo', gestor: null },          // mantém gerente_comercial, sem gestor acima
    { nome: 'Jackson', gestor: 'Jackson' },    // promovido, carteira própria (gestor de si)
  ],
  equipeMurilo: ['Raquel', 'Valdean', 'Christyan', 'Ellen', 'Dara'],
  equipeJackson: ['Brennda'],                   // profile existe como "Brennda"
  desativar: ['Gabriel', 'Keila', 'djfhsujdhfjsdhf'],
};

// senha temporária padrão — mesma do script criar-equipes.js
const SENHA_PADRAO = 'rm170611';

function norm(s) {
  return (s || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function resolverProfiles() {
  const { data, error } = await supabase.from('profiles').select('id, nome_completo, email, cargo, gestor_id, ativo');
  if (error) throw new Error(error.message);
  const porNome = {};
  for (const p of data) porNome[norm(p.nome_completo)] = p;
  return { todos: data, porNome };
}

async function fasePerfis() {
  let { porNome } = await resolverProfiles();

  // 1) cria Ellen e Dara (auth + profile)
  for (const novo of ORGANIGRAMA.criar) {
    if (porNome[norm(novo.nome)]) {
      console.log(`  = ${novo.nome} já existe (${porNome[norm(novo.nome)].id})`);
      continue;
    }
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: novo.email,
      password: SENHA_PADRAO,
      email_confirm: true,
      user_metadata: { nome_completo: novo.nome },
    });
    if (error) {
      console.log(`  ❌ criar ${novo.nome}: ${error.message}`);
      process.exit(1);
    }
    const gestor = porNome[norm(novo.gestor)];
    const { error: upErr } = await supabase
      .from('profiles')
      .update({ nome_completo: novo.nome, email: novo.email, cargo: 'vendedor', gestor_id: gestor.id, ativo: true })
      .eq('id', created.user.id);
    if (upErr) {
      console.log(`  ❌ profile ${novo.nome}: ${upErr.message}`);
      process.exit(1);
    }
    console.log(`  ✅ criado ${novo.nome} (${novo.email}) → gestor ${novo.gestor}`);
    ({ porNome } = await resolverProfiles());
  }

  // 2) gestores: Jackson promovido + gestor de si; Murilo mantido
  for (const g of ORGANIGRAMA.gestores) {
    const p = porNome[norm(g.nome)];
    if (!p) { console.log(`  ❌ gestor ${g.nome} não encontrado`); process.exit(1); }
    const gestorId = g.gestor ? porNome[norm(g.gestor)].id : null;
    const { error } = await supabase
      .from('profiles')
      .update({ cargo: 'gerente_comercial', gestor_id: gestorId, ativo: true })
      .eq('id', p.id);
    if (error) { console.log(`  ❌ ${g.nome}: ${error.message}`); process.exit(1); }
    console.log(`  ✅ ${g.nome} = gerente_comercial (gestor_id=${g.gestor || 'null'})`);
    ({ porNome } = await resolverProfiles());
  }

  // 3) equipes → gestor_id
  const equipes = [
    ...ORGANIGRAMA.equipeMurilo.map(n => [n, 'Murilo']),
    ...ORGANIGRAMA.equipeJackson.map(n => [n, 'Jackson']),
  ];
  for (const [nomeVend, nomeGestor] of equipes) {
    const vend = porNome[norm(nomeVend)] || porNome[norm(nomeVend) + 'nnda']; // Brennda ~ Brenda
    const gestor = porNome[norm(nomeGestor)];
    if (!vend) { console.log(`  ❌ vendedor ${nomeVend} não encontrado`); process.exit(1); }
    const { error } = await supabase.from('profiles').update({ gestor_id: gestor.id, ativo: true }).eq('id', vend.id);
    if (error) { console.log(`  ❌ ${nomeVend}: ${error.message}`); process.exit(1); }
    console.log(`  ✅ ${vend.nome_completo} → ${nomeGestor}`);
  }

  // 4) desativados
  for (const nome of ORGANIGRAMA.desativar) {
    const p = porNome[norm(nome)];
    if (!p) { console.log(`  ⚠️  ${nome} não encontrado (ok?)`); continue; }
    const { error } = await supabase.from('profiles').update({ ativo: false }).eq('id', p.id);
    if (error) { console.log(`  ❌ ${nome}: ${error.message}`); process.exit(1); }
    console.log(`  ✅ ${nome} desativado (ativo=false)`);
  }
}

// ---------- FASE 4: importação das planilhas ----------

// planilha -> nome do profile vendedor
const MAPA_PLANILHAS = {
  'RAQUEL.xls': 'Raquel',
  'VALDEAN.xls': 'Valdean',
  'CHRISTYAN.xls': 'Christyan',
  'ELLEN.xls': 'Ellen',
  'DARA.xls': 'Dara',
  'BRENDA.xls': 'Brenda',   // profile "Brennda"
  'JACKSON.xls': 'Jackson',
};

const ESPERADO_POR_ARQUIVO = {
  'RAQUEL.xls': 590,
  'VALDEAN.xls': 124,
  'CHRISTYAN.xls': 563,
  'ELLEN.xls': 23,
  'DARA.xls': 632,
  'BRENDA.xls': 748,
  'JACKSON.xls': 400,
};

// Total único real: 3.080 linhas - 7 duplicações de cpf_cnpj (4 internas + 3 entre
// planilhas; as 3 entre planilhas ficaram com o dono que apareceu primeiro no banco).
const ESPERADO_UNIQUE = {
  'RAQUEL.xls': 588,     // perdeu 1 dup interna + 1 dup externa p/ CHRISTYAN
  'VALDEAN.xls': 124,
  'CHRISTYAN.xls': 563,  // ganhou 1 dup externa da RAQUEL
  'ELLEN.xls': 23,
  'DARA.xls': 630,       // -2 (1 interna + 1 externa)
  'BRENDA.xls': 745,     // -3 (2 internas + 1 externa)
  'JACKSON.xls': 400,
};

function texto(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function parseDataBR(v) {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0, 10);
  return null;
}

function statusDoCliente(ativo, bloqueado) {
  if (bloqueado && norm(bloqueado) === 'sim') return 'bloqueado';
  if (ativo && norm(ativo) === 'sim') return 'ativo';
  return 'inativo';
}

function tipoPessoa(v, documento) {
  const t = norm(v);
  if (t.startsWith('fis') || t === 'pf' || t === 'pessoa_fisica') return 'pf';
  if (t.startsWith('juri') || t === 'pj' || t === 'pessoa_juridica') return 'pj';
  // fallback: infere pelo tamanho do documento (11=CPF, 14=CNPJ)
  const doc = (documento || '').replace(/\D/g, '');
  if (doc.length === 11) return 'pf';
  return 'pj';
}

function lerPlanilha(caminho) {
  const wb = XLSX.readFile(caminho, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  // range:3 = pula as 3 linhas de cabeçalho (cabeçalho fica na linha 4)
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, range: 3, defval: null });
}

function linhaParaCliente(row, vendedorId) {
  const codigo = texto(row[1]);
  const nome = texto(row[4]) || texto(row[3]);
  if (!codigo || !nome) return { erro: 'sem codigo/nome' };
  return {
    codigo_erp: codigo,
    tipo: tipoPessoa(row[24], row[5]),
    nome_razao_social: texto(row[3]) || texto(row[4]),
    nome_fantasia: nome,
    cpf_cnpj: texto(row[5]) ? String(row[5]).replace(/\D/g, '') || null : null,
    rg_ie: texto(row[6]),
    email: texto(row[22]),
    telefone: texto(row[8]),
    celular: texto(row[9]),
    whatsapp_id: null,
    cep: texto(row[27]),
    endereco: texto(row[25]),
    numero: texto(row[28]),
    complemento: texto(row[29]),
    bairro: texto(row[30]),
    cidade: texto(row[19]),
    estado: null,
    regiao_id: null,
    canal_origem_id: null,
    canal_atual_id: null,
    vendedor_responsavel_id: vendedorId,
    grupo_economico_id: null,
    matriz_id: null,
    status: statusDoCliente(texto(row[14]), texto(row[20])),
    segmento: null,
    potencial: null,
    data_cadastro: parseDataBR(row[10]),
    data_ultima_compra: null,
    data_proximo_contato: null,
  };
}

async function inserirComBisseccao(lote) {
  let inseridos = 0, rejeitadas = 0;
  async function tentar(parte) {
    if (parte.length === 0) return;
    const { error } = await supabase.from('clientes').insert(parte);
    if (!error) { inseridos += parte.length; return; }
    if (parte.length === 1) {
      rejeitadas++;
      console.log(`   ↳ rejeitada: codigo=${parte[0].codigo_erp} doc=${parte[0].cpf_cnpj || 's/doc'} — ${error.message}`);
      return;
    }
    const meio = Math.floor(parte.length / 2);
    await tentar(parte.slice(0, meio));
    await tentar(parte.slice(meio));
  }
  for (let i = 0; i < lote.length; i += 500) {
    await tentar(lote.slice(i, i + 500));
  }
  return { inseridos, rejeitadas };
}

async function faseImport() {
  const { porNome } = await resolverProfiles();

  // resolve ids dos vendedores
  const idsPorArquivo = {};
  for (const [arquivo, nomeVend] of Object.entries(MAPA_PLANILHAS)) {
    const p = porNome[norm(nomeVend)] || porNome['brennda'];
    if (!p) { console.log(`  ❌ vendedor ${nomeVend} não encontrado`); process.exit(1); }
    idsPorArquivo[arquivo] = p.id;
  }

  // retomável: dedupe contra o que JÁ está no banco (codigo_erp + cpf_cnpj único)
  const existentes = await fetchAll('clientes');
  const codigosVistos = new Set(existentes.map(c => (c.codigo_erp || '').toLowerCase()));
  const docsVistos = new Set(existentes.map(c => (c.cpf_cnpj || '').replace(/\D/g, '')).filter(Boolean));
  console.log(`  Estado atual: ${existentes.length} clientes já no banco`);

  let inseridosTotal = 0, dupTotal = 0, invalidasTotal = 0, rejeitadasTotal = 0;
  const resumo = {};

  for (const arquivo of Object.keys(MAPA_PLANILHAS)) {
    const rows = lerPlanilha(path.join(BASE_DIR, arquivo));
    const lote = [];
    let invalidas = 0, dups = 0;

    for (const row of rows) {
      if (!row || row.every(c => c === null || c === undefined || String(c).trim() === '')) continue;
      const cli = linhaParaCliente(row, idsPorArquivo[arquivo]);
      if (cli.erro) { invalidas++; continue; }
      const cod = cli.codigo_erp.toLowerCase();
      const doc = (cli.cpf_cnpj || '').replace(/\D/g, '');
      if (codigosVistos.has(cod) || (doc && docsVistos.has(doc))) { dups++; continue; }
      codigosVistos.add(cod);
      if (doc) docsVistos.add(doc);
      lote.push(cli);
    }

    const { inseridos, rejeitadas } = await inserirComBisseccao(lote);
    inseridosTotal += inseridos; dupTotal += dups;
    invalidasTotal += invalidas; rejeitadasTotal += rejeitadas;
    resumo[arquivo] = { linhasValidas: inseridos + dups, inseridos, duplicadosPulados: dups, invalidas, rejeitadas };
    console.log(`  ✅ ${arquivo}: +${inseridos} inseridos (dups: ${dups}, inválidas: ${invalidas}, rejeitadas: ${rejeitadas})`);
  }

  const resumoFinal = {
    geradoEm: new Date().toISOString(),
    inseridosTotal, dupTotal, invalidasTotal, rejeitadasTotal,
    bancoTotal: existentes.length + inseridosTotal,
    porArquivo: resumo,
  };
  fs.writeFileSync(path.join(BACKUP_DIR, 'import-summary.json'), JSON.stringify(resumoFinal, null, 2));
  console.log(`\nInseridos nesta rodada: ${inseridosTotal} | duplicados pulados: ${dupTotal} | rejeitadas: ${rejeitadasTotal}`);
  console.log(`Total no banco agora: ${resumoFinal.bancoTotal} (esperado único global: 3073)`);
}

// ---------- FASE 5: verificação ----------

async function faseVerify() {
  const esperadoTotal = Object.values(ESPERADO_UNIQUE).reduce((a, b) => a + b, 0);
  const { count: total } = await supabase.from('clientes').select('*', { count: 'exact', head: true });
  console.log(`\n=== CLIENTES ===`);
  console.log(`Total no banco: ${total} | esperado único: ${esperadoTotal} | linhas brutas nas planilhas: 3080`);

  const { data: profs } = await supabase.from('profiles').select('id, nome_completo, cargo, gestor_id, ativo, email');
  const nomePorId = {};
  for (const p of profs) nomePorId[p.id] = p.nome_completo;

  console.log(`\n=== CLIENTES POR VENDEDOR ===`);
  let ok = true;
  let soma = 0;
  for (const [arquivo, nomeVend] of Object.entries(MAPA_PLANILHAS)) {
    const p = profs.find(x => norm(x.nome_completo) === norm(nomeVend)) || profs.find(x => x.nome_completo === 'Brennda');
    const { count } = await supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('vendedor_responsavel_id', p.id);
    const esp = ESPERADO_UNIQUE[arquivo];
    const flag = count === esp ? '✅' : '❌';
    if (count !== esp) ok = false;
    soma += count || 0;
    console.log(`  ${flag} ${nomeVend}: ${count} (esperado ${esp}; planilha bruta: ${ESPERADO_POR_ARQUIVO[arquivo]})`);
  }
  console.log(`  Soma por vendedor: ${soma}${soma === total ? ' ✅' : ' ❌ (bate com o total?)'}`);

  // amostra de preenchimento dos campos importados
  const { data: amostra } = await supabase.from('clientes')
    .select('nome_razao_social, cpf_cnpj, telefone, celular, email, cidade, cep, data_cadastro, status, tipo')
    .limit(3073);
  const pct = (n) => `${Math.round((n / (amostra || []).length) * 100)}%`;
  console.log(`\n=== PREENCHIMENTO (${(amostra || []).length} amostra) ===`);
  for (const campo of ['nome_razao_social', 'cpf_cnpj', 'telefone', 'celular', 'email', 'cidade', 'cep', 'data_cadastro']) {
    console.log(`  ${campo}: ${pct((amostra || []).filter(r => r[campo]).length)}`);
  }

  console.log(`\n=== ORGANIGRAMA ===`);
  for (const p of profs.filter(x => x.ativo !== false).sort((a, b) => a.nome_completo.localeCompare(b.nome_completo))) {
    const gestor = p.gestor_id ? nomePorId[p.gestor_id] : '—';
    const ativo = p.ativo === false ? ' [INATIVO]' : '';
    console.log(`  ${p.cargo === 'gerente_comercial' ? '👔' : '👤'} ${p.nome_completo} (${p.email}) — gestor: ${gestor}${ativo}`);
  }
  console.log(`\nDesativados:`);
  for (const p of profs.filter(x => x.ativo === false)) console.log(`  ⛔ ${p.nome_completo} (${p.email})`);

  console.log(`\nResultado: ${ok && total === esperadoTotal ? '✅ TUDO OK' : '❌ DIVERGÊNCIA'}`);
}

// ---------- main ----------

const fase = process.argv[2];
const fases = { backup: faseBackup, wipe: faseWipe, perfis: fasePerfis, import: faseImport, verify: faseVerify };

if (!fases[fase]) {
  console.error('Uso: node scripts/rebase-base-clientes.js <backup|wipe|perfis|import|verify>');
  process.exit(1);
}

(async () => {
  console.log(`\n━━━ FASE: ${fase} ━━━`);
  await fases[fase]();
  console.log('━━━ FIM ━━━');
})().catch(err => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
