"use client";

/**
 * Painel inferior do Atendimento — dois containers lado a lado ocupando a
 * faixa entre os cards de métrica e a área de chat:
 *  - Esquerda: Top 20 melhores vendedores (MOCK por enquanto)
 *  - Direita:  listagem de clientes no mesmo estilo da página CLIENTES
 *              (reusa o componente ClientList) — dados MOCK por enquanto
 *
 * DADOS MOCKADOS (23/09/2026): substituir por fontes reais depois
 * (vendedores: ranking de vendas; clientes: igual a página /clientes).
 */

import { Trophy } from "lucide-react";
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

// No mesmo formato do supabase `clientes` que o ClientList espera
const CLIENTES_MOCK = [
  { id: "c1", nome_razao_social: "Distribuidora Rio Verde LTDA", cpf_cnpj: "12.345.678/0001-90", telefone: "556234165014", email: "contato@rioverde.com.br", cidade: "Goiânia", estado: "GO", status: "ativo", tipo: "juridica" },
  { id: "c2", nome_razao_social: "Supermercado Bom Preço", cpf_cnpj: "98.765.432/0001-10", telefone: "5562988887777", email: "compras@bompreco.com", cidade: "Aparecida de Goiânia", estado: "GO", status: "ativo", tipo: "juridica" },
  { id: "c3", nome_razao_social: "Padaria São João", cpf_cnpj: "45.678.912/0001-33", telefone: "556235554444", email: "padaria.saojoao@gmail.com", cidade: "Anápolis", estado: "GO", status: "ativo", tipo: "juridica" },
  { id: "c4", nome_razao_social: "Mercado Ponto Certo", cpf_cnpj: "22.334.455/0001-66", telefone: "5562977776666", email: "ponto.certo@outlook.com", cidade: "Rio Verde", estado: "GO", status: "ativo", tipo: "juridica" },
  { id: "c5", nome_razao_social: "Restaurante Sabor Caseiro", cpf_cnpj: "33.445.566/0001-77", telefone: "556236665555", email: "saborcaseiro@hotmail.com", cidade: "Goiânia", estado: "GO", status: "ativo", tipo: "juridica" },
  { id: "c6", nome_razao_social: "Farmácia Vida Nova", cpf_cnpj: "55.667.788/0001-99", telefone: "5562966665555", email: "vidanova@farmacia.com", cidade: "Goiânia", estado: "GO", status: "ativo", tipo: "juridica" },
  { id: "c7", nome_razao_social: "Auto Peças Três Rios", cpf_cnpj: "66.778.899/0001-22", telefone: "556237776666", email: "vendas@tresrios.com.br", cidade: "Três Rios", estado: "RJ", status: "ativo", tipo: "juridica" },
  { id: "c8", nome_razao_social: "Hortifruti Frescor", cpf_cnpj: "77.889.900/0001-55", telefone: "5562955554444", email: "frescor@hortifruti.com", cidade: "Anápolis", estado: "GO", status: "ativo", tipo: "juridica" },
  { id: "c9", nome_razao_social: "Casa do Móvel Planejado", cpf_cnpj: "88.990.011/0001-88", telefone: "556238887777", email: "contato@casadomovel.com.br", cidade: "Goiânia", estado: "GO", status: "ativo", tipo: "juridica" },
  { id: "c10", nome_razao_social: "Depósito Central Química", cpf_cnpj: "11.223.344/0001-12", telefone: "5562944443333", email: "central@quimica.com.br", cidade: "Rio Verde", estado: "GO", status: "ativo", tipo: "juridica" },
  { id: "c11", nome_razao_social: "Lanchonete Ponto de Encontro", cpf_cnpj: "13.141.516/0001-44", telefone: "556239998888", email: "pontoencontro@gmail.com", cidade: "Aparecida de Goiânia", estado: "GO", status: "ativo", tipo: "fisica" },
  { id: "c12", nome_razao_social: "Construtora Pedra Alta", cpf_cnpj: "15.161.718/0001-91", telefone: "5562933332222", email: "obras@pedraalta.com.br", cidade: "Goiânia", estado: "GO", status: "ativo", tipo: "juridica" },
  { id: "c13", nome_razao_social: "Papelaria Escola A+, Bazar e Utilidades", cpf_cnpj: "17.181.920/0001-07", telefone: "556232223333", email: "escolaamais@papelaria.com", cidade: "Anápolis", estado: "GO", status: "ativo", tipo: "juridica" },
  { id: "c14", nome_razao_social: "Pet Shop Amigo Fiel", cpf_cnpj: "19.202.122/0001-63", telefone: "5562922221111", email: "amigofiel@petshop.com", cidade: "Goiânia", estado: "GO", status: "ativo", tipo: "juridica" },
  { id: "c15", nome_razao_social: "Ótica Visão Perfeita", cpf_cnpj: "21.222.324/0001-79", telefone: "556231114444", email: "visaoperfeita@otica.com", cidade: "Goiânia", estado: "GO", status: "ativo", tipo: "juridica" },
];

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[partes.length - 1]?.[0] ?? "")).toUpperCase();
}

interface PainelInferiorProps {
  /** Abre a conversa dentro do CRM (fluxo do Buscar Contatos) */
  onAbrirConversa: (telefone: string, nome?: string) => void;
}

export function PainelInferior({ onAbrirConversa }: PainelInferiorProps) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-3 shrink-0 h-[165px]">
      {/* Esquerda: Top 20 melhores vendedores */}
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

      {/* Direita: Listagem de clientes (mesmo estilo da página CLIENTES) */}
      <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 shrink-0">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Clientes
          </p>
          <span className="text-[10px] text-slate-400">
            {CLIENTES_MOCK.length}
          </span>
          <span className="ml-auto text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            dados de exemplo
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          <ClientList clientes={CLIENTES_MOCK} onAbrirConversa={onAbrirConversa} />
        </div>
      </div>
    </div>
  );
}
