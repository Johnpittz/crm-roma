import { NextRequest, NextResponse } from "next/server";
import { checkNumbers } from "@/lib/waha";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { numbers, instance } = body;

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return NextResponse.json(
        { error: "Campo 'numbers' é obrigatório e deve ser um array" },
        { status: 400 }
      );
    }

    if (numbers.length > 20) {
      return NextResponse.json(
        { error: "Máximo de 20 números por requisição" },
        { status: 400 }
      );
    }

    const result = await checkNumbers({ numbers, session: instance });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      results: result.results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao verificar números" },
      { status: 500 }
    );
  }
}
