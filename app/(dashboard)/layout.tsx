import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils/cn";

/**
 * Layout do Dashboard (Rotas Autenticadas)
 *
 * Este layout envolve todas as páginas que requerem autenticação.
 * Inclui a sidebar de navegação e o header com título da página.
 */

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  // Busca perfil do usuário logado
  const { data: profile } = await supabase
    .from("profiles")
    .select("nome_completo, cargo, avatar_url")
    .eq("id", data.user.id)
    .single();

  const user = {
    email: data.user.email ?? "",
    nome: profile?.nome_completo ?? data.user.email?.split("@")[0] ?? "Usuário",
    canal: profile?.cargo ?? "Comercial",
    cargo: profile?.cargo ?? "vendedor",
    avatar_url: profile?.avatar_url ?? null,
  };

  return (
    <DashboardShell user={user}>{children}</DashboardShell>
  );
}

function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: {
    email: string;
    nome: string;
    canal: string;
    cargo: string;
    avatar_url: string | null;
  };
}) {
  return (
    <div className="h-screen overflow-hidden bg-slate-50">
      <Sidebar user={user} />
      <main className="h-full flex flex-col transition-all duration-300 ease-in-out ml-64">
        <Header />
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </main>
    </div>
  );
}
