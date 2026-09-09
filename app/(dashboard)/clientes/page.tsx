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
  const formSubmitido = typeof searchParams.q === "string" || typeof searchParams.status === "string";
  const filtroStatus = typeof searchParams.status === "string" ? searchParams.status : "todos";
  const ordenar = typeof searchParams.ordenar === "string" ? searchParams.ordenar : "az";
  const mostrarTodos = searchParams.mostrar === "todos";
  const deveBuscar = formSubmitido || mostrarTodos; // Buscar se formulário enviado OU "mostrar todos" clicado

  // Estatísticas — queries HEAD (só count, sem dados) em paralelo
  const [totalRes, ativosRes, inativosRes, bloqueadosRes, prospectsRes] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }),
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("status", "inativo"),
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("status", "bloqueado"),
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("status", "prospect"),
  ]);

  const stats = {
    total: totalRes.count ?? 0,
    ativos: ativosRes.count ?? 0,
    inativos: inativosRes.count ?? 0,
    bloqueados: bloqueadosRes.count ?? 0,
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

    // Ordenação dinâmica
    let orderField = "nome_razao_social";
    let ascending = true;
    if (ordenar === "za") {
      orderField = "nome_razao_social";
      ascending = false;
    } else if (ordenar === "recente") {
      orderField = "created_at";
      ascending = false;
    } else if (ordenar === "antigo") {
      orderField = "created_at";
      ascending = true;
    }

    const result = await query.order(orderField, { ascending }).limit(2000);
    clientes = result.data;
    count = result.count ?? 0;
    error = result.error;
  }

  return (
    <div className="flex flex-col">
      {/* Stats compactos - 7 colunas */}
      <div className="grid grid-cols-7 gap-1.5 mb-4">
        <Card className="p-2">
          <p className="text-xs text-slate-500 leading-tight">Total de Clientes</p>
          <p className="text-3xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-2">
          <p className="text-xs text-slate-500 leading-tight">Ativos (30d)</p>
          <p className="text-3xl font-bold text-emerald-600">{stats.ativos}</p>
        </Card>
        <Card className="p-2">
          <p className="text-xs text-slate-500 leading-tight">Inativos (60d)</p>
          <p className="text-3xl font-bold text-orange-500">{stats.inativos}</p>
        </Card>
        <Card className="p-2">
          <p className="text-xs text-slate-500 leading-tight">Rec (61d+)</p>
          <p className="text-3xl font-bold text-red-600">{stats.bloqueados}</p>
        </Card>
        <Card className="p-2">
          <p className="text-xs text-slate-500 leading-tight">Prospect</p>
          <p className="text-3xl font-bold text-amber-600">{stats.prospects}</p>
        </Card>
        <Card className="p-2">
          <p className="text-xs text-slate-500 leading-tight">Transfer</p>
          <p className="text-3xl font-bold text-blue-600">0</p>
        </Card>
        <Card className="p-2">
          <p className="text-xs text-slate-500 leading-tight">Excluir</p>
          <p className="text-3xl font-bold text-slate-400">0</p>
        </Card>
      </div>

      {/* Conteúdo principal */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
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
        <CardContent className="flex-1 flex flex-col min-h-0 p-6 overflow-hidden">
          {/* Barra de busca e filtros */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                name="q"
                defaultValue={busca}
                placeholder="Digite o nome, CNPJ ou o que você procura..."
                className="pl-10"
              />
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg flex-wrap gap-1">
              {[
                { value: "todos", label: "Todos" },
                { value: "ativo", label: "Ativos" },
                { value: "inativo", label: "Inativos" },
                { value: "bloqueado", label: "Rec" },
                { value: "prospect", label: "Prospect" },
                { value: "transfer", label: "Transfer" },
                { value: "excluir", label: "Excluir" },
              ].map((s) => (
                <Link
                  key={s.value}
                  href={`/clientes?status=${s.value}${busca ? `&q=${busca}` : ""}${mostrarTodos ? "&mostrar=todos" : ""}`}
                  className={cn(
                    "px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                    filtroStatus === s.value
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Barra de ordenação */}
          <div className="flex items-center justify-between mb-3 pb-3 border-b">
            <span className="text-xs text-slate-500">Ordenar por:</span>
            <div className="flex items-center gap-1">
              <Link
                href={`/clientes?status=${filtroStatus}${busca ? `&q=${busca}` : ""}&ordenar=az${mostrarTodos ? "&mostrar=todos" : ""}`}
                className={cn(
                  "px-2 py-1 text-[10px] font-medium rounded transition-colors",
                  ordenar === "az"
                    ? "bg-slate-800 text-white"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                A→Z
              </Link>
              <Link
                href={`/clientes?status=${filtroStatus}${busca ? `&q=${busca}` : ""}&ordenar=za${mostrarTodos ? "&mostrar=todos" : ""}`}
                className={cn(
                  "px-2 py-1 text-[10px] font-medium rounded transition-colors",
                  ordenar === "za"
                    ? "bg-slate-800 text-white"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                Z→A
              </Link>
              <Link
                href={`/clientes?status=${filtroStatus}${busca ? `&q=${busca}` : ""}&ordenar=recente${mostrarTodos ? "&mostrar=todos" : ""}`}
                className={cn(
                  "px-2 py-1 text-[10px] font-medium rounded transition-colors",
                  ordenar === "recente"
                    ? "bg-slate-800 text-white"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                Recentes
              </Link>
              <Link
                href={`/clientes?status=${filtroStatus}${busca ? `&q=${busca}` : ""}&ordenar=antigo${mostrarTodos ? "&mostrar=todos" : ""}`}
                className={cn(
                  "px-2 py-1 text-[10px] font-medium rounded transition-colors",
                  ordenar === "antigo"
                    ? "bg-slate-800 text-white"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                Antigos
              </Link>
            </div>
          </div>

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

          {/* Aviso ao mostrar todos */}
          {mostrarTodos && !busca && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-700">
              ⚠️ <strong>Modo completo:</strong> Carregando todos os {count} clientes. Use os filtros para refinar a busca.
            </div>
          )}

          {/* Debug */}
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 mb-4">
              <strong>Erro na query:</strong> {error.message} (code: {error.code})
            </div>
          )}
          {(totalRes.error || ativosRes.error || inativosRes.error || bloqueadosRes.error || prospectsRes.error) && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 mb-4">
              <strong>Erro nas estatísticas:</strong> {(totalRes.error || ativosRes.error || inativosRes.error || bloqueadosRes.error || prospectsRes.error)?.message || "Verifique os dados no banco"}
            </div>
          )}

          {/* Lista de clientes */}
          {deveBuscar && (
            <div className="flex-1 min-h-0 overflow-y-auto mt-4">
              <div className="space-y-0.5">
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
