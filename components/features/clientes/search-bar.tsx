"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface SearchBarProps {
  initialSearch: string;
  initialStatus: string;
  initialOrdenar: string;
  mostrarTodos: boolean;
}

export function SearchBar({
  initialSearch,
  initialStatus,
  initialOrdenar,
  mostrarTodos,
}: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(initialSearch);

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "todos") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Preserve mostrar=todos if set
      if (mostrarTodos) {
        params.set("mostrar", "todos");
      }
      router.push(`/clientes?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, mostrarTodos]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (searchValue) {
      params.set("q", searchValue);
    } else {
      params.delete("q");
    }
    if (mostrarTodos) {
      params.set("mostrar", "todos");
    }
    router.push(`/clientes?${params.toString()}`, { scroll: false });
  };

  const statusFilters = [
    { value: "todos", label: "Todos" },
    { value: "ativo", label: "Ativos" },
    { value: "inativo", label: "Inativos" },
    { value: "bloqueado", label: "Rec" },
    { value: "prospect", label: "Prospect" },
    { value: "transfer", label: "Transfer" },
    { value: "excluir", label: "Excluir" },
  ];

  return (
    <>
      {/* Barra de busca */}
      <form onSubmit={handleSearch} className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Digite o nome, CNPJ ou o que você procura..."
            className="pl-10"
          />
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg flex-wrap gap-1">
          {statusFilters.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => updateParams("status", s.value)}
              className={cn(
                "px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                initialStatus === s.value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </form>

      {/* Barra de ordenação */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b">
        <span className="text-xs text-slate-500">Ordenar por:</span>
        <div className="flex items-center gap-1">
          {[
            { value: "az", label: "A→Z" },
            { value: "za", label: "Z→A" },
            { value: "recente", label: "Mais recente" },
            { value: "antigo", label: "Mais antigo" },
          ].map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => updateParams("ordenar", o.value)}
              className={cn(
                "px-2 py-1 text-[10px] font-medium rounded transition-colors",
                initialOrdenar === o.value
                  ? "bg-slate-800 text-white"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
