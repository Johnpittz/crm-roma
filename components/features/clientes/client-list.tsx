"use client";

import { useState } from "react";
import { ModalDetalhesCliente } from "./modal-detalhes-cliente";

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

interface ClientListProps {
  clientes: Cliente[];
  /** Quando presente, o modal abre a conversa dentro do CRM em vez de navegar */
  onAbrirConversa?: (telefone: string, nome?: string) => void;
}

export function ClientList({ clientes, onAbrirConversa }: ClientListProps) {
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function handleClick(cliente: Cliente) {
    setSelectedCliente(cliente);
    setModalOpen(true);
  }

  return (
    <>
      <div className="space-y-0.5">
        {clientes.map((cliente) => (
          <p
            key={cliente.id}
            className="text-sm text-muted-foreground py-0.5 truncate hover:text-foreground cursor-pointer transition-colors"
            onClick={() => handleClick(cliente)}
          >
            {cliente.nome_razao_social}
          </p>
        ))}
      </div>
      
      <ModalDetalhesCliente
        cliente={selectedCliente}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onAbrirConversa={onAbrirConversa}
      />
    </>
  );
}
