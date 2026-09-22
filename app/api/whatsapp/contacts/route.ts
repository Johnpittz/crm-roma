import { NextRequest, NextResponse } from "next/server";
import { findContacts } from "@/lib/waha";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const instance = searchParams.get("instance") || undefined;

    if (limit > 500) {
      return NextResponse.json(
        { error: "Máximo de 500 contatos por requisição" },
        { status: 400 }
      );
    }

    const result = await findContacts({ search, limit, session: instance });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      contacts: result.contacts,
      total: result.total,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao buscar contatos" },
      { status: 500 }
    );
  }
}
