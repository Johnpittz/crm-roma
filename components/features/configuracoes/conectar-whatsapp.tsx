"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2, Plug, Plus, Smartphone, RefreshCw, Unplug } from "lucide-react";

/**
 * Configurações → "CONECTAR WHATSAPP".
 *
 * Toda a configuração (criar sessão, webhook do CRM, start, QR) é feita pela
 * rota /api/whatsapp/conectar — aqui só clicar e escanear:
 *   1. Conectar WhatsApp → POST {action:"iniciar"} (sessão atual)
 *   2. POST {action:"qr"} em loop → QR na tela (renova sozinho) até WORKING
 * O QR do WhatsApp dura ~20 s; se vencer, o WAHA cai e a rota reinicia sozinha.
 */

const API = "/api/whatsapp/conectar";
const INTERVALO_MS = 2500;

interface SessaoLista {
  name: string;
  status: string;
  numero: string | null;
  nome: string | null;
}

export function ConectarWhatsApp() {
  const [sessoes, setSessoes] = useState<SessaoLista[]>([]);
  const [sessaoAtual, setSessaoAtual] = useState<string>("");
  const [sessaoAtiva, setSessaoAtiva] = useState<string>("");
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /** desconexão é destrutiva: só passa daqui depois do aviso lido (regra 01/10/2026) */
  const [confirmandoDesc, setConfirmandoDesc] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(API);
      if (!res.ok) return;
      const dados = await res.json();
      setSessoes(dados.sessoes || []);
      setSessaoAtual(dados.sessaoAtual || "");
    } catch {
      /* primeira carga falhou: o fluxo de conexão ainda funciona */
    }
  }, []);

  useEffect(() => {
    void carregar();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [carregar]);

  const agendar = useCallback((sessao: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void consultarQr(sessao);
    }, INTERVALO_MS);
  }, []);

  const consultarQr = useCallback(
    async (sessao: string) => {
      try {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "qr", session: sessao }),
        });
        const dados = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErro(dados.error || "Não consegui gerar o QR. Tente de novo.");
          return;
        }
        setStatus(dados.status || null);
        setQr(dados.qr || null);
        if (dados.status === "WORKING") {
          void carregar();
          return;
        }
        if (dados.qr || dados.status) agendar(sessao);
      } catch {
        setErro("Falha de conexão ao consultar o QR.");
      }
    },
    [agendar, carregar]
  );

  const iniciar = useCallback(
    async (novo: boolean) => {
      setTrabalhando(true);
      setErro(null);
      setQr(null);
      try {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "iniciar", novo }),
        });
        const dados = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErro(dados.error || "Não foi possível configurar a conexão.");
          return;
        }
        setStatus(dados.status || null);
        if (dados.status === "WORKING") {
          setSessaoAtiva(dados.sessao || "");
          void carregar();
          return;
        }
        setSessaoAtiva(dados.sessao || "");
        // primeira tentativa de QR agora (sem esperar o loop)
        await consultarQr(dados.sessao);
      } catch {
        setErro("Falha de conexão ao conectar.");
      } finally {
        setTrabalhando(false);
      }
    },
    [carregar, consultarQr]
  );

  const desconectar = async () => {
    const nome = sessaoAtual;
    setTrabalhando(true);
    setErro(null);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "desconectar", session: nome || undefined }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(dados?.error || "Não consegui desconectar o número.");
      if (timerRef.current) clearTimeout(timerRef.current);
      setQr(null);
      setConfirmandoDesc(false);
      setStatus(dados.status || "STOPPED");
      setSessoes((atual) => atual.map((s) => (s.name === nome ? { ...s, status: dados.status || "STOPPED" } : s)));
      await carregar();
    } catch (e: any) {
      setErro(e?.message || "Não consegui desconectar o número.");
    } finally {
      setTrabalhando(false);
    }
  };

  const conectada = sessoes.find((s) => s.status === "WORKING") || null;
  const aguardandoScan = !!qr && status !== "WORKING";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-900">Número no CRM</p>
              {conectada ? (
                <p className="text-xs text-slate-500">{conectada.numero || conectada.name}</p>
              ) : (
                <p className="text-xs text-slate-500">Nenhum número respondendo no CRM.</p>
              )}
            </div>
          </div>
          <Badge className={conectada ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>
            {conectada ? "Conectado" : status === "STARTING" || status === "SCAN_QR_CODE" ? "Conectando…" : "Desconectado"}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void iniciar(false)} disabled={trabalhando}>
            {trabalhando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
            Conectar WhatsApp
          </Button>
          <Button variant="outline" onClick={() => void iniciar(true)} disabled={trabalhando}>
            <Plus className="mr-2 h-4 w-4" />
            Conectar outro número
          </Button>
          {conectada && !confirmandoDesc && (
            <Button variant="outline" onClick={() => setConfirmandoDesc(true)} disabled={trabalhando}>
              <Unplug className="mr-2 h-4 w-4" />
              Desconectar número
            </Button>
          )}
        </div>

        {confirmandoDesc && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-700">
                  SE VOCÊ DESCONECTAR O NÚMERO, NÃO VERÁ MAIS AS MENSAGENS
                </p>
                <p className="mt-1 text-xs text-red-600">
                  O CRM para de receber (e responder) as conversas daquele número — elas continuam
                  só no celular. Dá para conectar de novo pelo mesmo botão quando quiser.
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmandoDesc(false)} disabled={trabalhando}>
                Cancelar
              </Button>
              <Button variant="destructive" size="sm" onClick={() => void desconectar()} disabled={trabalhando}>
                {trabalhando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}
                Desconectar
              </Button>
            </div>
          </div>
        )}

        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

        {aguardandoScan && (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">
              {trabalhando ? "Configurando a conexão…" : "Aponte a câmera do celular pro QR"}
            </p>
            <img src={qr!} alt="QR do WhatsApp" className="h-56 w-56 rounded-md bg-white p-2 shadow" />
            <p className="text-center text-xs text-slate-500">
              No celular: <strong>WhatsApp → ⋮ → Aparelhos conectados → Conectar aparelho</strong>.
              <br />
              O QR se renova sozinho — se expirar, é só esperar o próximo.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void consultarQr(sessaoAtiva)}
              disabled={trabalhando}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Gerar QR agora
            </Button>
          </div>
        )}

        {sessoes.length > 0 && (
          <div className="mt-4 space-y-1">
            {sessoes.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {s.numero || s.name}
                  {s.nome ? ` · ${s.nome}` : ""}
                </span>
                <span className={s.status === "WORKING" ? "text-emerald-600" : "text-slate-400"}>
                  {s.status === "WORKING" ? "OK" : s.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
