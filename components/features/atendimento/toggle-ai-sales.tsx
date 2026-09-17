"use client";

import { useState, useEffect } from "react";
import { Bot, BotOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Toggle para ligar/desligar o AI Sales (bot de vendas)
 * Aparece no header do atendimento. Só gestores podem alterar.
 */
export function ToggleAISales() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isGestor, setIsGestor] = useState(false);
  const [toggling, setToggling] = useState(false);
  const supabase = createClient();

  // Carrega status do bot
  useEffect(() => {
    (async () => {
      try {
        // Verifica cargo
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("cargo")
          .eq("id", user.id)
          .single();

        const gestor = ["diretor", "admin", "gerente_comercial"].includes(profile?.cargo || "");
        setIsGestor(gestor);

        // Busca config do bot
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch("/api/ai-sales/config", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setEnabled(data.enabled ?? true);
        }
      } catch (err) {
        console.error("Erro ao carregar config AI Sales:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  const toggle = async () => {
    if (!isGestor || toggling) return;

    setToggling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/ai-sales/config", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ enabled: !enabled }),
      });

      if (res.ok) {
        const data = await res.json();
        setEnabled(data.enabled);
      }
    } catch (err) {
      console.error("Erro ao toggle AI Sales:", err);
    } finally {
      setToggling(false);
    }
  };

  // Só mostra pra gestores
  if (!isGestor) return null;

  return (
    <button
      onClick={toggle}
      disabled={loading || toggling}
      className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-all ${
        enabled
          ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
          : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100"
      } ${toggling ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
      title={enabled ? "Bot ATIVO — clique pra desligar" : "Bot DESLIGADO — clique pra ligar"}
    >
      {enabled ? (
        <>
          <Bot className="h-4 w-4" />
          <span>IA Ligada</span>
        </>
      ) : (
        <>
          <BotOff className="h-4 w-4" />
          <span>IA Desligada</span>
        </>
      )}
    </button>
  );
}
