"use client";

/**
 * Painel inferior do Atendimento — dois containers lado a lado ocupando a
 * faixa entre os cards de métrica e a área de chat:
 *  - Esquerda: TOP 20 CLIENTES (os que mais compraram) — GET /api/clientes/top
 *  - Direita:  CLIENTES REAIS da carteira + FILTRO — o vendedor acha o cliente
 *              por nome, CNPJ, telefone ou e-mail sem sair da tela.
 *
 * REGRA: quem está no Top 20 NÃO aparece na listagem CLIENTES — por isso o card
 * direito chama /api/clientes com excluir_top20=1 (o corte é no servidor, junto
 * com o contador, e vale também na busca por nome/CNPJ).
 *
 * O card busca sozinho em GET /api/clientes (escopo decidido no servidor pelo
 * cargo — lib/carteira.ts) e repete a busca com debounce de 300ms quando há
 * termo: filtrar os 300 carregados mentiria, a filtragem é no servidor.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Trophy, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ClientList } from "@/components/features/clientes/client-list";
import { createClient } from "@/lib/supabase/client";
import type { TopCliente } from "@/lib/top-clientes";

/** Linhas por carga do card (a carteira do gestor tem ~1.9 mil). */
const LIMITE_CARTEIRA = "300";
/** Debounce da digitação antes de bater no servidor. */
const DEBOUNCE_BUSCA_MS = 300;

// Mesmo formato do supabase `clientes` que o ClientList espera
export interface ClienteCard {
  id: string;
  nome_razao_social: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  status: string;
  tipo: string;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[partes.length - 1]?.[0] ?? "")).toUpperCase();
}

interface PainelInferiorProps {
  /** Abre a conversa dentro do CRM (fluxo do Buscar Contatos) */
  onAbrirConversa: (telefone: string, nome?: string) => void;
}

export function PainelInferior({ onAbrirConversa }: PainelInferiorProps) {
  const [clientes, setClientes] = useState<ClienteCard[]>([]);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);

  // ── Top 20 clientes (os que mais compraram) ──
  const [topClientes, setTopClientes] = useState<TopCliente[]>([]);
  const [topCarregando, setTopCarregando] = useState(true);

  const buscarTop = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await createClient().auth.getSession();
      if (!session) return;

      const res = await fetch("/api/clientes/top", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;

      const data = await res.json();
      setTopClientes(Array.isArray(data.clientes) ? data.clientes : []);
    } catch (err) {
      console.error("[PainelInferior] falha ao buscar o Top 20:", err);
    } finally {
      setTopCarregando(false);
    }
  }, []);

  // O ranking não muda enquanto ele digita: busca só na carga inicial.
  useEffect(() => {
    void buscarTop();
  }, [buscarTop]);

  const buscar = useCallback(async (termo: string) => {
    try {
      setCarregando(true);
      const {
        data: { session },
      } = await createClient().auth.getSession();
      if (!session) return;

      const params = new URLSearchParams({ limite: LIMITE_CARTEIRA, excluir_top20: "1" });
      const termoLimpo = termo.trim();
      if (termoLimpo) params.set("busca", termoLimpo);

      const res = await fetch(`/api/clientes?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;

      const data = await res.json();
      setClientes(Array.isArray(data.clientes) ? data.clientes : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
    } catch (err) {
      console.error("[PainelInferior] falha ao buscar clientes:", err);
    } finally {
      setCarregando(false);
    }
  }, []);

  // Carga inicial imediata; a partir daí, debounce no que o usuário digita.
  const primeiraCarga = useRef(true);
  useEffect(() => {
    if (primeiraCarga.current) {
      primeiraCarga.current = false;
      void buscar(busca);
      return;
    }
    const timer = setTimeout(() => void buscar(busca), DEBOUNCE_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [busca, buscar]);

  const termo = busca.trim();
  const truncado = !termo && total > clientes.length;

  return (
    <div className="grid grid-cols-2 gap-3 mb-3 shrink-0 h-[230px]">
      {/* Esquerda: TOP 20 CLIENTES (os que mais compraram) */}
      <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 shrink-0">
          <Trophy className="h-4 w-4 text-amber-500" />
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Top 20 clientes
          </p>
          <span className="ml-auto text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            os que mais compraram
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-50">
          {topCarregando ? (
            <p className="text-xs text-slate-400 px-3 py-2">Carregando ranking…</p>
          ) : topClientes.length === 0 ? (
            <p className="text-xs text-slate-400 px-3 py-2">
              Sem vendas ainda — conclua tarefas no kanban (com valor) para
              começar o ranking.
            </p>
          ) : (
            topClientes.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2.5 px-3 py-1.5">
                <span
                  className={`w-5 text-center text-[10px] font-bold shrink-0 ${
                    i < 3 ? "text-amber-500" : "text-slate-400"
                  }`}
                >
                  {i + 1}º
                </span>
                <div className="h-6 w-6 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                  {iniciais(c.nome)}
                </div>
                <span className="text-xs text-slate-700 flex-1 truncate" title={c.nome}>
                  {c.nome}
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {c.pedidos} {c.pedidos === 1 ? "compra" : "compras"}
                </span>
                <span className="text-xs font-bold text-slate-800 shrink-0 tabular-nums">
                  R$ {c.valor.toLocaleString("pt-BR")}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Direita: CLIENTES REAIS da carteira + filtro (mesmo ClientList de /clientes) */}
      <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 shrink-0">
          <Users className="h-4 w-4 text-slate-500" />
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Clientes
          </p>
          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            {total}
          </span>
          {carregando ? (
            <span className="ml-auto text-[9px] text-slate-400">buscando…</span>
          ) : (
            truncado && (
              <span className="ml-auto text-[9px] text-slate-400">
                mostrando {clientes.length} de {total}
              </span>
            )
          )}
        </div>

        {/* FILTRO — nome, CNPJ, telefone ou e-mail, sem sair da tela */}
        <div className="px-3 py-2 border-b border-slate-100 shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Filtrar por nome, CNPJ, telefone..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full h-8 text-xs pl-7 pr-2"
            />
          </div>
        </div>

        <div
          className={`flex-1 min-h-0 overflow-y-auto p-2 transition-opacity ${
            carregando ? "opacity-50" : ""
          }`}
        >
          {clientes.length > 0 ? (
            <ClientList clientes={clientes} onAbrirConversa={onAbrirConversa} />
          ) : carregando ? null : termo ? (
            <p className="text-xs text-slate-400 py-1">
              Nenhum cliente encontrado para “{termo}”.
            </p>
          ) : (
            <p className="text-xs text-slate-400 py-1">
              Nenhum cliente na sua carteira.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
