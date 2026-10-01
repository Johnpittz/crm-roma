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
  /**
   * Situação de contato por id (card do ATENDIMENTO):
   * atrasado -> linha em vermelho, realizado -> linha em verde.
   * Sem este mapa a lista fica neutra (página /clientes não muda).
   */
  contatoPorId?: Record<string, string | undefined>;
}

export function ClientList({ clientes, onAbrirConversa, contatoPorId }: ClientListProps) {
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function handleClick(cliente: Cliente) {
    setSelectedCliente(cliente);
    setModalOpen(true);
  }

  return (
    <>
      <div className="space-y-0.5">
        {clientes.map((cliente) => {
          const situacao = contatoPorId?.[cliente.id];
          return (
            <p
              key={cliente.id}
              className={`text-sm py-0.5 truncate hover:text-foreground cursor-pointer transition-colors ${
                situacao === "atrasado"
                  ? "text-red-600 font-semibold"
                  : situacao === "realizado"
                    ? "text-emerald-600"
                    : "text-muted-foreground"
              }`}
              onClick={() => handleClick(cliente)}
            >
              {cliente.nome_razao_social}
            </p>
          );
        })}
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
