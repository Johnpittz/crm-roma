"use client";

import { useState } from "react";
import { User, Phone, Mail, MapPin, Building2, FileText, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

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

export function ModalDetalhesCliente({ cliente, open, onOpenChange }: ModalDetalhesClienteProps) {
  if (!cliente) return null;

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
      </DialogContent>
    </Dialog>
  );
}
