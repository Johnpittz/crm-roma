"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MostrarTodosButtonProps {
  count: number;
}

export function MostrarTodosButton({ count }: MostrarTodosButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <LayoutGrid className="h-4 w-4" />
        Mostrar grade
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Carregar todos os clientes?
            </DialogTitle>
            <DialogDescription>
              Você está prestes a carregar <strong>{count} clientes</strong> de
              uma vez. Isso pode demorar alguns segundos e deixar a página mais
              pesada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Link href="/clientes?mostrar=todos">
              <Button onClick={() => setOpen(false)}>Continuar assim mesmo</Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
