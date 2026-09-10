"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Se a página carregou com query params (?q=, ?mostrar=todos, etc.)
 * redireciona para a URL limpa, limpando a listagem.
 */
export function LimparUrlNoLoad() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Se tem query params na URL, limpa
    if (window.location.search) {
      router.replace(pathname);
    }
  }, [pathname, router]);

  return null;
}
