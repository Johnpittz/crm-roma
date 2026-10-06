"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Busca global com Ctrl+K (05/10/2026).
 *
 * Pesquisa cliente, conversa e tarefa num painel só e só NAVEGA para filtros que
 * já existem nas páginas — nenhuma regra de negócio muda:
 *   cliente  → /clientes?q=...         (a página já lê ?q)
 *   conversa → /atendimento?conversa=  (a página abre a conversa)
 *   tarefa   → /kanban?tab=tarefas&q=  (campo de busca já preenchido)
 *
 * Conversas e tarefas são buscadas numa lista leve carregada uma vez por sessão
 * do painel; clientes vão ao servidor (`/api/clientes?busca=`), respeitando a
 * carteira de quem está logado.
 */

export type ResultadoBusca = {
  tipo: "cliente" | "conversa" | "tarefa";
  id: string;
  titulo: string;
  subtitulo?: string;
  href: string;
};

const SECOES: { tipo: ResultadoBusca["tipo"]; rotulo: string }[] = [
  { tipo: "cliente", rotulo: "Clientes" },
  { tipo: "conversa", rotulo: "Conversas" },
  { tipo: "tarefa", rotulo: "Tarefas" },
];

function combina(alvo: Record<string, any>, termo: string): boolean {
  return ["nome_cliente", "nome_razao_social", "telefone_cliente", "telefone", "titulo", "cliente_nome", "assunto"].some(
    (campo) => String(alvo?.[campo] || "").toLowerCase().includes(termo)
  );
}

export function BuscaGlobal() {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [indice, setIndice] = useState(0);
  const router = useRouter();
  const listasRef = useRef<{ conversas: any[]; tarefas: any[] } | null>(null);

  // ── Atalho: Ctrl/Cmd + K ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberto((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ── Teclado dentro do painel: Esc, setas, Enter ──
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setAberto(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndice((i) => Math.min(i + 1, Math.max(resultados.length - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndice((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        const alvo = resultados[indice];
        if (alvo) {
          e.preventDefault();
          setAberto(false);
          router.push(alvo.href);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberto, resultados, indice, router]);

  // ── Busca com debounce (250 ms) e termo mínimo de 2 caracteres ──
  useEffect(() => {
    const t = termo.trim().toLowerCase();
    if (!aberto || t.length < 2) {
      setResultados([]);
      setIndice(0);
      return;
    }
    const timer = setTimeout(() => void buscar(t), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo, aberto]);

  async function buscar(termoLimpo: string) {
    setCarregando(true);
    try {
      if (!listasRef.current) {
        const [con, tar] = await Promise.all([
          fetch("/api/atendimentos?status=aberto")
            .then((r) => r.json())
            .catch(() => ({})),
          fetch("/api/tarefas")
            .then((r) => r.json())
            .catch(() => ({})),
        ]);
        listasRef.current = {
          conversas: con.atendimentos || [],
          tarefas: tar.tarefas || [],
        };
      }

      const cli = await fetch(`/api/clientes?busca=${encodeURIComponent(termoLimpo)}&limite=6`)
        .then((r) => r.json())
        .catch(() => ({}));

      const novos: ResultadoBusca[] = [];
      for (const c of (cli.clientes || []).slice(0, 5)) {
        const nome = c.nome_razao_social || c.nome || "Cliente";
        novos.push({
          tipo: "cliente",
          id: c.id,
          titulo: nome,
          subtitulo: c.telefone || c.celular || c.cnpj || "",
          href: `/clientes?q=${encodeURIComponent(nome)}`,
        });
      }
      for (const a of (listasRef.current.conversas || [])
        .filter((a: any) => combina(a, termoLimpo))
        .slice(0, 4)) {
        novos.push({
          tipo: "conversa",
          id: a.id,
          titulo: a.nome_cliente || "Conversa",
          subtitulo: a.telefone_cliente || "",
          href: `/atendimento?conversa=${a.id}`,
        });
      }
      for (const t of (listasRef.current.tarefas || [])
        .filter((t: any) => combina(t, termoLimpo))
        .slice(0, 4)) {
        novos.push({
          tipo: "tarefa",
          id: t.id,
          titulo: t.titulo || "Tarefa",
          subtitulo: t.cliente_nome || t.prazo || "",
          href: `/kanban?tab=tarefas&q=${encodeURIComponent(t.cliente_nome || t.titulo || "")}`,
        });
      }

      setResultados(novos);
      setIndice(0);
    } finally {
      setCarregando(false);
    }
  }

  function ir(resultado: ResultadoBusca) {
    setAberto(false);
    router.push(resultado.href);
  }

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-[12vh]"
      onClick={() => setAberto(false)}
      data-testid="busca-global"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#667781]" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            autoFocus
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar cliente, conversa ou tarefa..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-[#667781]"
          />
          <kbd className="rounded border px-1.5 py-0.5 text-[10px] text-[#667781]">ESC</kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto py-2">
          {termo.trim().length < 2 && (
            <p className="px-4 py-3 text-sm text-[#667781]">Digite ao menos 2 letras para buscar.</p>
          )}

          {termo.trim().length >= 2 && resultados.length === 0 && (
            <p className="px-4 py-3 text-sm text-[#667781]">
              {carregando ? "Buscando..." : "Nada encontrado."}
            </p>
          )}

          {SECOES.map((secao) => {
            const itens = resultados.filter((r) => r.tipo === secao.tipo);
            if (itens.length === 0) return null;
            return (
              <div key={secao.tipo} className="mb-1">
                <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#667781]">
                  {secao.rotulo}
                </p>
                {itens.map((r) => {
                  const posicao = resultados.indexOf(r);
                  return (
                    <button
                      key={`${r.tipo}-${r.id}`}
                      onClick={() => ir(r)}
                      onMouseEnter={() => setIndice(posicao)}
                      className={`flex w-full flex-col items-start px-4 py-2 text-left ${
                        posicao === indice ? "bg-[#f0f2f5]" : "hover:bg-[#f5f6f6]"
                      }`}
                    >
                      <span className="text-sm text-[#111b21]">{r.titulo}</span>
                      {r.subtitulo ? (
                        <span className="text-xs text-[#667781]">{r.subtitulo}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="border-t px-4 py-2 text-[11px] text-[#667781]">
          <kbd className="rounded border px-1">↑</kbd> <kbd className="rounded border px-1">↓</kbd> navegar ·{" "}
          <kbd className="rounded border px-1">Enter</kbd> abrir · <kbd className="rounded border px-1">Ctrl K</kbd> abre/fecha
        </div>
      </div>
    </div>
  );
}
