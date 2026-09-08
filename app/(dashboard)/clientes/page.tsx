import Link from "next/link";
import {
  Users,
  Search,
  Filter,
  MoreHorizontal,
  Phone,
  Mail,
  MapPin,
  Building2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  LayoutGrid,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

  const formatCurrency = (value: number | null) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value ?? 0);

  const statusBadge = (status: string) => {
    switch (status) {
      case "ativo":
        return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
      case "churn":
        return "bg-red-100 text-red-700 hover:bg-red-100";
      case "prospect":
        return "bg-amber-100 text-amber-700 hover:bg-amber-100";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "ativo":
        return "Ativo";
      case "churn":
        return "Churn";
      case "prospect":
        return "Prospect";
      default:
        return status;
    }
  };

  const diasSemCompra = (dataUltimaCompra: string | null) => {
    if (!dataUltimaCompra) return null;
    const diff = Math.floor(
      (new Date().getTime() - new Date(dataUltimaCompra).getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff > 0 ? diff : 0;
  };

  return (
    <div className="space-y-6">
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
      <Card>
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
        <CardContent>
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
            <ScrollArea className="h-[600px]">
              <div className="space-y-1">
                {clientes && clientes.length > 0 ? (
                  clientes.map((cliente: any) => {
                    const semCompra = diasSemCompra(cliente.data_ultima_compra);

                    return (
                      <div
                        key={cliente.id}
                        className="flex items-center gap-3 p-2 rounded-lg border hover:bg-slate-50 transition-colors"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={`https://api.dicebear.com/7.x/initials/svg?seed=${cliente.nome_razao_social}`}
                          />
                          <AvatarFallback className="bg-slate-200 text-slate-700 text-xs">
                            {cliente.nome_razao_social?.charAt(0) ?? "?"}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900 truncate">
                              {cliente.nome_razao_social}
                            </h3>
                             {cliente.grupo_economico_id && (
                               <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                                 <Building2 className="h-3 w-3 mr-1" />
                                 {cliente.grupo?.nome || "Grupo"}
                               </Badge>
                             )}
                            {cliente.status === "churn" && semCompra != null && (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {semCompra} dias
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Phone className="h-2.5 w-2.5" />
                              {cliente.telefone ?? "—"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Mail className="h-2.5 w-2.5" />
                              {cliente.email ?? "—"}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5" />
                              {cliente.cidade && cliente.estado
                                ? `${cliente.cidade}/${cliente.estado}`
                                : "—"}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <Badge className={cn(statusBadge(cliente.status))}>
                            {statusLabel(cliente.status)}
                          </Badge>
                          {cliente.cpf_cnpj && (
                            <p className="text-sm text-slate-500 mt-1">
                              {cliente.cpf_cnpj}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
                            Ver
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
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
