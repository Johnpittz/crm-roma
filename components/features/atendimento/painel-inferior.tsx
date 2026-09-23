"use client";

/**
 * Painel inferior do Atendimento — dois containers lado a lado ocupando a
 * faixa entre os cards de métrica e a área de chat:
 *  - Esquerda: Top 20 melhores vendedores (MOCK por enquanto)
 *  - Direita:  CLIENTES REAIS, escopados pela carteira do usuário logado
 *              (vendedor = só o dele, gestor = carteira toda) via GET /api/clientes
 *
 * O card não faz query própria: recebe `clientes` pronto da página, que busca
 * em /api/clientes — o escopo é decidido no servidor pelo cargo (lib/carteira.ts).
 */

import { Trophy, Users } from "lucide-react";
import { ClientList } from "@/components/features/clientes/client-list";

interface VendedorRanking {
  nome: string;
  vendas: number;
  valor: number; // em reais
}

const TOP_VENDEDORES: VendedorRanking[] = [
  { nome: "Marcelo Souza", vendas: 48, valor: 187400 },
  { nome: "Ana Beatriz Lima", vendas: 45, valor: 176950 },
  { nome: "Roberto Nascimento", vendas: 41, valor: 165300 },
  { nome: "Juliana Ferreira", vendas: 39, valor: 158700 },
  { nome: "Carlos Eduardo Alves", vendas: 37, valor: 149250 },
  { nome: "Patrícia Gomes", vendas: 35, valor: 142800 },
  { nome: "Fernando Ribeiro", vendas: 33, valor: 136400 },
  { nome: "Camila Rodrigues", vendas: 31, valor: 129900 },
  { nome: "Ricardo Barbosa", vendas: 29, valor: 121350 },
  { nome: "Larissa Cardoso", vendas: 27, valor: 114600 },
  { nome: "Eduardo Martins", vendas: 25, valor: 108200 },
  { nome: "Vanessa Pereira", vendas: 24, valor: 103500 },
  { nome: "Thiago Almeida", vendas: 22, valor: 97400 },
  { nome: "Beatriz Santos", vendas: 21, valor: 92800 },
  { nome: "Gustavo Rodrigues", vendas: 19, valor: 87300 },
  { nome: "Aline Carvalho", vendas: 18, valor: 82600 },
  { nome: "Rodrigo Teixeira", vendas: 16, valor: 77900 },
  { nome: "Natália Rocha", vendas: 15, valor: 73400 },
  { nome: "Felipe Andrade", vendas: 14, valor: 69100 },
  { nome: "Priscila Mendes", vendas: 12, valor: 64500 },
];

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
  /** Clientes reais já escopados pela carteira do logado (vem de /api/clientes) */
  clientes: ClienteCard[];
  /** Tamanho da carteira — pode ser maior que a lista, que vem com limite */
  totalClientes?: number;
  /** Abre a conversa dentro do CRM (fluxo do Buscar Contatos) */
  onAbrirConversa: (telefone: string, nome?: string) => void;
}

export function PainelInferior({
  clientes,
  totalClientes,
  onAbrirConversa,
}: PainelInferiorProps) {
  const total = totalClientes ?? clientes.length;
  const truncado = total > clientes.length;

  return (
    <div className="grid grid-cols-2 gap-3 mb-3 shrink-0 h-[165px]">
      {/* Esquerda: Top 20 melhores vendedores (mock) */}
      <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 shrink-0">
          <Trophy className="h-4 w-4 text-amber-500" />
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Top 20 melhores vendedores
          </p>
          <span className="ml-auto text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            dados de exemplo
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-50">
          {TOP_VENDEDORES.map((v, i) => (
            <div key={v.nome} className="flex items-center gap-2.5 px-3 py-1.5">
              <span
                className={`w-5 text-center text-[10px] font-bold shrink-0 ${
                  i < 3 ? "text-amber-500" : "text-slate-400"
                }`}
              >
                {i + 1}º
              </span>
              <div className="h-6 w-6 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                {iniciais(v.nome)}
              </div>
              <span className="text-xs text-slate-700 flex-1 truncate">
                {v.nome}
              </span>
              <span className="text-[10px] text-slate-400 shrink-0">
                {v.vendas} vendas
              </span>
              <span className="text-xs font-bold text-slate-800 shrink-0 tabular-nums">
                R$ {v.valor.toLocaleString("pt-BR")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Direita: CLIENTES REAIS da carteira (mesmo ClientList da página /clientes) */}
      <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 shrink-0">
          <Users className="h-4 w-4 text-slate-500" />
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Clientes
          </p>
          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            {total}
          </span>
          {truncado && (
            <span className="ml-auto text-[9px] text-slate-400">
              mostrando {clientes.length} de {total}
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {clientes.length > 0 ? (
            <ClientList clientes={clientes} onAbrirConversa={onAbrirConversa} />
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
