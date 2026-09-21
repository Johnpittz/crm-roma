"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, UserPlus, Phone, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WhatsAppContact {
  id: string;
  remoteJid: string;
  pushName: string | null;
  profilePicUrl: string | null;
  isSaved: boolean;
  isGroup: boolean;
  type: string;
}

interface BuscarContatosWhatsAppProps {
  open: boolean;
  onClose: () => void;
  onSelect: (contact: WhatsAppContact) => void;
  instance?: string;
}

export function BuscarContatosWhatsApp({
  open,
  onClose,
  onSelect,
  instance,
}: BuscarContatosWhatsAppProps) {
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchContacts = useCallback(async (searchTerm: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (instance) params.set("instance", instance);
      params.set("limit", "100");

      const response = await fetch(`/api/whatsapp/contacts?${params}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao buscar contatos");
        setContacts([]);
      } else {
        setContacts(data.contacts || []);
      }
    } catch (err: any) {
      setError(err.message || "Erro de conexão");
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [instance]);

  // Debounce na busca
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchContacts(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, fetchContacts]);

  // Buscar contatos ao abrir o modal
  useEffect(() => {
    if (open) {
      setSearch("");
      fetchContacts("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, fetchContacts]);

  const extractPhone = (jid: string) => {
    return jid.replace("@s.whatsapp.net", "").replace("@lid", "");
  };

  const handleSelect = (contact: WhatsAppContact) => {
    onSelect(contact);
    onClose();
    setSearch("");
    setContacts([]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1d32] border border-white/10 rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-[#3B64CF]" />
            <h3 className="text-sm font-medium text-white">
              Buscar Contatos WhatsApp
            </h3>
          </div>
          <button
            onClick={onClose}
            className="h-6 w-6 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou número..."
              className="w-full h-9 text-sm pl-8 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#3B64CF]"
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
          {loading && (
            <div className="h-32 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-[#3B64CF] animate-spin" />
            </div>
          )}

          {error && (
            <div className="h-32 flex items-center justify-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {!loading && !error && contacts.length === 0 && (
            <div className="h-32 flex items-center justify-center">
              <p className="text-sm text-white/40">
                {search
                  ? "Nenhum contato encontrado"
                  : "Digite para buscar contatos"}
              </p>
            </div>
          )}

          {!loading && !error && contacts.length > 0 && (
            <div className="space-y-0.5">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => handleSelect(contact)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left rounded-lg"
                >
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full bg-[#3B64CF]/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {contact.profilePicUrl ? (
                      <img
                        src={contact.profilePicUrl}
                        alt={contact.pushName || ""}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserPlus className="h-4 w-4 text-[#3B64CF]" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-white truncate">
                        {contact.pushName || "Sem nome"}
                      </span>
                      {contact.isSaved && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 bg-green-500/20 text-green-400 border-green-500/30"
                        >
                          Salvo
                        </Badge>
                      )}
                      {contact.isGroup && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 bg-purple-500/20 text-purple-400 border-purple-500/30"
                        >
                          Grupo
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-white/40">
                      {extractPhone(contact.remoteJid)}
                    </span>
                  </div>

                  {/* Action */}
                  <MessageSquare className="h-4 w-4 text-white/30 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-white/10">
          <p className="text-xs text-white/30">
            {contacts.length} contato(s) encontrado(s)
          </p>
        </div>
      </div>
    </div>
  );
}
