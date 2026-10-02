import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Botão "CONECTAR WHATSAPP" das configurações.
 *
 * Automatiza o runbook docs/runbook-waha-numeros.md que antes era feito à mão
 * (criar sessão → webhook → start → puxar o PNG do QR → conferir status).
 *
 *   GET  /api/whatsapp/conectar      → status das sessões do CRM
 *   POST {action:"iniciar", novo?}   → garante sessão + webhook e dá start
 *   POST {action:"qr", session}      → devolve o QR (data URL) ou confirma
 *
 * Dois passos rápidos de propósito: o QR expira em ~20 s e a Vercel limita a
 * duração da função — quem espera (e renova) é o front, com polling.
 */

function baseWaha(): string {
  return process.env.WAHA_API_URL || process.env.WAHA_API_URL_INTERNAL || "http://localhost:3000";
}
function chaveWaha(): string {
  return process.env.WAHA_API_KEY || "";
}
function sessaoPadrao(): string {
  return process.env.WAHA_SESSION || "ROMA_1";
}
function prefixoSessao(): string {
  return process.env.WAHA_SESSION_PREFIX || "ROMA";
}

/** Webhook do CRM: sem ele as mensagens do número novo não chegam aqui. */
function urlWebhook(): string {
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "";
  const base = !host ? "" : host.startsWith("http") ? host : `https://${host}`;
  const url = `${base}/api/webhooks/waha`;
  const token = process.env.WAHA_WEBHOOK_TOKEN;
  return token ? `${url}?token=${token}` : url;
}

async function waha(
  metodo: string,
  caminho: string,
  corpo?: unknown
): Promise<{ ok: boolean; status: number; dados: any }> {
  const resp = await fetch(`${baseWaha()}${caminho}`, {
    method: metodo,
    headers: { "X-Api-Key": chaveWaha(), "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await resp.text();
  let dados: any = null;
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch {
      dados = texto;
    }
  }
  return { ok: resp.ok, status: resp.status, dados };
}

async function wahaBytes(caminho: string): Promise<{ ok: boolean; bytes: Uint8Array | null; contentType: string }> {
  const resp = await fetch(`${baseWaha()}${caminho}`, {
    method: "GET",
    headers: { "X-Api-Key": chaveWaha() },
  });
  if (!resp.ok) return { ok: false, bytes: null, contentType: "" };
  const buffer = new Uint8Array(await resp.arrayBuffer());
  return { ok: true, bytes: buffer, contentType: resp.headers.get("content-type") || "" };
}

/** Só mexe nas sessões deste CRM (prefixo ROMA) — não em sessões de outros projetos. */
function sessaoPermitida(nome: string): boolean {
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(nome)) return false;
  return new RegExp(`^${prefixoSessao()}(_\\d+)?$`, "i").test(nome);
}

/** Próximo ROMA_N livre. */
async function proximaSessao(): Promise<string> {
  const consulta = await waha("GET", "/api/sessions");
  const lista: any[] = Array.isArray(consulta.dados) ? consulta.dados : consulta.dados?.sessions || [];
  const alvo = `${prefixoSessao().toUpperCase()}_`;
  let maior = 0;
  for (const item of lista) {
    const nome = String(item?.name || "").toUpperCase();
    if (!nome.startsWith(alvo)) continue;
    const numero = nome.match(/_(\d+)$/);
    if (numero) maior = Math.max(maior, parseInt(numero[1], 10));
  }
  return `${prefixoSessao()}_${maior + 1}`;
}

/** Cria a sessão se não existir e garante o webhook apontando pro CRM. */
async function garantirSessao(nome: string): Promise<{ status: string | null; erro: string | null }> {
  const consulta = await waha("GET", `/api/sessions/${nome}`);
  if (consulta.status === 404) {
    const criada = await waha("POST", "/api/sessions", { name: nome });
    if (!criada.ok) {
      return { status: null, erro: criada.dados?.error || criada.dados || "Não foi possível criar a sessão" };
    }
  }
  // O WAHA (2026.9) guarda em `config.webhooks` (array). `webhook` singular devolve
  // 200 e é IGNORADO — testado na mão na instância de produção.
  const webhooksAtuais = consulta.dados?.config?.webhooks;
  const urlAtual = urlWebhook();
  const jaConfigurado =
    Array.isArray(webhooksAtuais) &&
    webhooksAtuais.some((w: any) => String(w?.url || "") === urlAtual);
  if (!jaConfigurado) {
    await waha("PUT", `/api/sessions/${nome}`, {
      config: {
        webhooks: [
          {
            url: urlAtual,
            events: ["message.any", "message.ack", "session.status"],
          },
        ],
      },
    });
  }
  const depois = await waha("GET", `/api/sessions/${nome}`);
  return { status: depois.dados?.status || consulta.dados?.status || null, erro: null };
}

async function autenticado(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return !!data?.user;
  } catch {
    return false;
  }
}

export async function GET() {
  if (!(await autenticado())) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const consulta = await waha("GET", "/api/sessions");
  const lista: any[] = Array.isArray(consulta.dados) ? consulta.dados : consulta.dados?.sessions || [];
  const prefixo = prefixoSessao().toUpperCase();
  const sessoes = lista
    .filter((s) => String(s?.name || "").toUpperCase().startsWith(prefixo))
    .map((s) => ({
      name: String(s.name),
      status: String(s.status || "UNKNOWN"),
      numero: s?.me?.id ? String(s.me.id).replace(/@.*/, "") : null,
      nome: s?.me?.pushName || null,
    }));
  return NextResponse.json({ sessaoAtual: sessaoPadrao(), sessoes });
}

export async function POST(request: NextRequest) {
  if (!(await autenticado())) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const acao = body?.action === "qr" ? "qr" : "iniciar";

  let nome: string;
  if (acao === "iniciar" && body?.novo) {
    nome = await proximaSessao();
  } else {
    nome = String(body?.session || sessaoPadrao());
  }

  if (!sessaoPermitida(nome)) {
    return NextResponse.json({ error: "Sessão não permitida" }, { status: 400 });
  }

  // ── iniciar: garante sessão + webhook e dá start ──
  if (acao === "iniciar") {
    const garantida = await garantirSessao(nome);
    if (garantida.erro) return NextResponse.json({ error: garantida.erro }, { status: 502 });
    if (garantida.status === "WORKING") {
      return NextResponse.json({ sessao: nome, status: "WORKING", qr: null });
    }
    const start = await waha("POST", `/api/sessions/${nome}/start`);
    const status = start.dados?.status || (start.ok ? "STARTING" : null);
    if (!start.ok && !start.dados?.status) {
      return NextResponse.json(
        { error: start.dados?.error || "Não foi possível iniciar a sessão" },
        { status: 502 }
      );
    }
    return NextResponse.json({ sessao: nome, status: status || "STARTING", qr: null });
  }

  // ── qr: QR novo, confirmação pós-scan ou recuperação de sessão caída ──
  const consulta = await waha("GET", `/api/sessions/${nome}`);
  if (consulta.status === 404) {
    return NextResponse.json({ error: "Sessão não existe. Inicie primeiro." }, { status: 404 });
  }
  const status: string | null = consulta.dados?.status || null;

  if (status === "WORKING") {
    return NextResponse.json({ sessao: nome, status, qr: null });
  }

  if (status === "SCAN_QR_CODE") {
    const png = await wahaBytes(`/api/${nome}/auth/qr`);
    const isPng = !!png.ok && !!png.bytes && png.bytes[0] === 0x89 && png.bytes[1] === 0x50;
    if (isPng) {
      return NextResponse.json({
        sessao: nome,
        status,
        qr: `data:image/png;base64,${Buffer.from(png.bytes!).toString("base64")}`,
      });
    }
    // O WAHA devolve JSON de erro quando a sessão caiu — caímos no reinício.
    console.error(`[Conectar] QR indisponível para ${nome} (status ${status})`);
  }

  if (status === "FAILED" || status === "SCAN_QR_CODE" || status === "STOPPED") {
    await waha("POST", `/api/sessions/${nome}/stop`);
    const start = await waha("POST", `/api/sessions/${nome}/start`);
    const novoStatus = start.dados?.status || "STARTING";
    return NextResponse.json({ sessao: nome, status: novoStatus, qr: null });
  }

  return NextResponse.json({ sessao: nome, status, qr: null });
}
