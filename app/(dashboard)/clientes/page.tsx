import Link from "next/link";
import {
  Users,
  Search,
  Filter,
  LayoutGrid,
  TrendingUp,
  TrendingDown,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/server";
import { ModalNovoCliente } from "@/components/features/clientes/modal-novo-cliente";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ClientesPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function ClientesPage({ searchParams }: ClientesPageProps) {
  const supabase = createClient();
  const busca = typeof searchParams.q === "string" ? searchParams.q : "";
  const filtroStatus = typeof searchParams.status === "string" ? searchParams.status : "todos";
  const mostrarTodos = searchParams.mostrar === "todos";
  const deveBuscar = busca || mostrarTodos;

  // Estatísticas — queries HEAD (só count, sem dados) em paralelo
  const [totalRes, ativosRes, churnRes, prospectsRes] = await Promise.all([
    supabase.from("clientes").select("*", { count: "exact", head: true }),
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("status", "churn"),
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("status", "prospect"),
  ]);

  const stats = {
    total: totalRes.count ?? 0,
    ativos: ativosRes.count ?? 0,
    churn: churnRes.count ?? 0,
    prospects: prospectsRes.count ?? 0,
  };

  // Só busca clientes se houver busca ou "mostrar todos"
  let clientes: any[] | null = null;
  let count = 0;
  let error: any = null;

  if (deveBuscar) {
    let query = supabase.from("clientes").select("*, grupo:grupos_economicos!grupo_economico_id(id, nome)", { count: "exact" });

    if (busca) {
      query = query.ilike("nome_razao_social", `%${busca}%`);
    }

    if (filtroStatus !== "todos") {
      query = query.eq("status", filtroStatus);
    }

    const result = await query.order("nome_razao_social", { ascending: true }).limit(200);
    clientes = result.data;
    count = result.count ?? 0;
    error = result.error;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total de Clientes</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Clientes Ativos</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.ativos}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Em Churn</p>
                <p className="text-2xl font-bold text-red-600">{stats.churn}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Prospects</p>
                <p className="text-2xl font-bold text-amber-600">{stats.prospects}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conteúdo principal */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Clientes</CardTitle>
              <CardDescription>
                {deveBuscar
                  ? `${count} cliente(s) encontrado(s)`
                  : "Busque por nome ou CNPJ para encontrar clientes"}
              </CardDescription>
            </div>
            <ModalNovoCliente />
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 p-6">
          {/* Barra de busca sempre visível */}
          <form className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                name="q"
                defaultValue={busca}
                placeholder="Digite o nome, CNPJ ou o que você procura..."
                className="pl-10"
              />
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {["todos", "ativo", "churn", "prospect"].map((s) => (
                <Link
                  key={s}
                  href={`/clientes?status=${s}${busca ? `&q=${busca}` : ""}${mostrarTodos ? "&mostrar=todos" : ""}`}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize",
                    filtroStatus === s
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {s === "todos" ? "Todos" : s === "ativo" ? "Ativos" : s === "churn" ? "Churn" : "Prospects"}
                </Link>
              ))}
            </div>
            <Button variant="outline" size="icon" type="submit">
              <Filter className="h-4 w-4" />
            </Button>
          </form>

          {/* Ações abaixo da busca */}
          {!deveBuscar && (
            <div className="flex items-center justify-center gap-4 py-8 border-t border-dashed">
              <Link href="/clientes?mostrar=todos">
                <Button variant="outline" className="gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Mostrar grade
                </Button>
              </Link>
              <span className="text-sm text-slate-400">ou</span>
              <ModalNovoCliente />
            </div>
          )}

          {/* Debug */}
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 mb-4">
              <strong>Erro na query:</strong> {error.message} (code: {error.code})
            </div>
          )}
          {(totalRes.error || ativosRes.error || churnRes.error || prospectsRes.error) && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 mb-4">
              <strong>Erro nas estatísticas:</strong> {(totalRes.error || ativosRes.error)?.message}
            </div>
          )}

          {/* Lista de clientes */}
          {deveBuscar && (
            <ScrollArea className="flex-1 min-h-0">
              <div>
                {clientes && clientes.length > 0 ? (
                  clientes.map((cliente: any) => (
                    <p key={cliente.id} className="text-sm text-muted-foreground py-0.5 truncate hover:text-foreground cursor-pointer transition-colors">
                      {cliente.nome_razao_social}
                    </p>
                  ))
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <Search className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-lg font-medium">Nenhum cliente encontrado</p>
                    <p className="text-sm">Tente ajustar a busca ou os filtros.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
