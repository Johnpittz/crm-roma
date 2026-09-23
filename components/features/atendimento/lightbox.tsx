"use client";

import { useEffect } from "react";

/**
 * Lightbox de imagem: expande a mídia dentro do CRM (overlay), em vez de abrir aba nova.
 * Fecha com clique no fundo ou tecla Esc; clique na imagem não fecha.
 */
export function Lightbox({ url, onClose }: { url: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div
      data-testid="lightbox-overlay"
      role="button"
      aria-label="Fechar visualização"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 cursor-zoom-out"
      onClick={onClose}
    >
      <img
        src={url}
        alt="Imagem ampliada"
        className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl cursor-default"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
