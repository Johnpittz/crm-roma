"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Search, Calendar, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificacoesBell } from "@/components/notificacoes-bell";

// Mapeamento de títulos por rota
const routeTitles: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Visão gerencial" },
  "/atendimento": { title: "Atendimento", subtitle: "Minha área de trabalho" },
  "/clientes": { title: "Clientes", subtitle: "Gestão de clientes" },
  "/vendas": { title: "Vendas", subtitle: "Histórico de vendas" },
  "/campanhas": { title: "Campanhas", subtitle: "Incentivos e metas" },
  "/configuracoes": { title: "Configurações", subtitle: "Preferências do sistema" },
  "/ajuda": { title: "Central de Ajuda", subtitle: "Aprenda a usar o CRM-ROMA" },
};

export function Header() {
  const pathname = usePathname();
  const routeInfo = routeTitles[pathname] || { title: "CRM ROMA" };

  const formatDate = () => {
    return new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur-md px-6 py-2">
      <div className="flex items-center justify-between">
        {/* Title */}
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {routeInfo.title}
          </h1>
          {routeInfo.subtitle && (
            <p className="text-xs text-slate-500">{routeInfo.subtitle}</p>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Date */}
          <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
            <Calendar className="h-4 w-4" />
            <span className="capitalize">{formatDate()}</span>
          </div>

          {/* Search */}
          <Button variant="ghost" size="icon" className="relative">
            <Search className="h-5 w-5 text-slate-600" />
          </Button>

          {/* Ajuda */}
          <Link href="/ajuda">
            <Button variant="ghost" size="icon" title="Central de Ajuda">
              <HelpCircle className="h-5 w-5 text-slate-600" />
            </Button>
          </Link>

          {/* Notifications */}
          <NotificacoesBell />
        </div>
      </div>
    </header>
  );
}
