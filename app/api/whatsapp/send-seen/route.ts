import { NextRequest, NextResponse } from "next/server";
import { enviarLido } from "@/lib/waha";

export const dynamic = "force-dynamic";

/**
 * Marca a conversa como lida no WhatsApp (WAHA POST /api/sendSeen).
 * Chamado pelo chat-inline ao abrir/visualizar uma conversa (Fase 7).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { telefone } = body;

    if (!telefone) {
      return NextResponse.json(
        { error: "Campo 'telefone' é obrigatório" },
        { status: 400 }
      );
    }

    const result = await enviarLido(telefone);

    return NextResponse.json({
      success: result.success,
      error: result.error,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao marcar como lido" },
      { status: 500 }
    );
  }
}
