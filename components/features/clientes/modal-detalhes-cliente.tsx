"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Phone, Mail, MapPin, Building2, FileText, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { urlWaMe, telefoneInternacional } from "@/lib/telefone";

interface Cliente {
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

interface ModalDetalhesClienteProps {
  cliente: Cliente | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Quando presente, o botão de WhatsApp abre a conversa DENTRO do CRM
   * (fluxo do Buscar Contatos). Sem ele (página CLIENTES), navega para
   * /atendimento?telefone=... e a página abre o chat na montagem.
   */
  onAbrirConversa?: (telefone: string, nome?: string) => void;
}

function getStatusColor(status: string) {
  switch (status) {
    case "ativo": return "bg-emerald-100 text-emerald-700";
    case "inativo": return "bg-orange-100 text-orange-700";
    case "bloqueado": return "bg-slate-100 text-slate-700";
    case "prospect": return "bg-amber-100 text-amber-700";
    case "churn": return "bg-red-100 text-red-700";
    default: return "bg-slate-100 text-slate-700";
  }
}

export function ModalDetalhesCliente({ cliente, open, onOpenChange, onAbrirConversa }: ModalDetalhesClienteProps) {
  const router = useRouter();

  if (!cliente) return null;

  // Abre a conversa no CRM (mesmo fluxo do "Buscar Contatos WhatsApp"):
  // dentro do Atendimento via callback; vindo de CLIENTES via navegação
  // /atendimento?telefone=... (a página abre o chat e limpa a URL).
  const handleAbrirConversa = () => {
    onOpenChange(false);
    const intl = telefoneInternacional(cliente.telefone);
    if (!intl) return;
    if (onAbrirConversa) {
      onAbrirConversa(intl, cliente.nome_razao_social);
      return;
    }
    router.push(
      `/atendimento?telefone=${encodeURIComponent(intl)}&nome=${encodeURIComponent(cliente.nome_razao_social)}`
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Detalhes do Cliente
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          {/* Nome */}
          <div className="flex items-start gap-3">
            <Building2 className="h-4 w-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500">Nome / Razão Social</p>
              <p className="text-sm font-medium">{cliente.nome_razao_social}</p>
            </div>
          </div>

          {/* Status e Tipo */}
          <div className="flex items-start gap-3">
            <Tag className="h-4 w-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500">Status / Tipo</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getStatusColor(cliente.status)}>
                  {cliente.status}
                </Badge>
                <Badge variant="outline">
                  {cliente.tipo === "pj" ? "PJ" : "PF"}
                </Badge>
              </div>
            </div>
          </div>

          {/* CPF/CNPJ */}
          {cliente.cpf_cnpj && (
            <div className="flex items-start gap-3">
              <FileText className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500">{cliente.tipo === "pj" ? "CNPJ" : "CPF"}</p>
                <p className="text-sm font-medium">{cliente.cpf_cnpj}</p>
              </div>
            </div>
          )}

          {/* Telefone */}
          {cliente.telefone && (
            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500">Telefone</p>
                <p className="text-sm font-medium">{cliente.telefone}</p>
              </div>
            </div>
          )}

          {/* Email */}
          {cliente.email && (
            <div className="flex items-start gap-3">
              <Mail className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500">E-mail</p>
                <p className="text-sm font-medium">{cliente.email}</p>
              </div>
            </div>
          )}

          {/* Localização */}
          {(cliente.cidade || cliente.estado) && (
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500">Localização</p>
                <p className="text-sm font-medium">
                  {[cliente.cidade, cliente.estado].filter(Boolean).join(", ")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Abrir conversa no CRM (mesmo fluxo do Buscar Contatos) */}
        {cliente.telefone && (
          <button
            type="button"
            onClick={handleAbrirConversa}
            className="inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-[#25D366] hover:bg-[#1ebe5b] text-white text-sm font-medium transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
            </svg>
            Abrir conversa no WhatsApp
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
