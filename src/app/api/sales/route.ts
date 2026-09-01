import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { listSales, createSaleDraft } from "@/services/sale.service";
import { getUserMessage, isAppError } from "@/lib/errors";
import type { SaleStatus } from "@prisma/client";

// =============================================================================
// /api/sales — Sales List & Draft Creation API
// =============================================================================

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") ?? undefined;
    const customerId = searchParams.get("customerId") ?? undefined;
    const status = (searchParams.get("status") as SaleStatus | "ALL") ?? undefined;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const result = await listSales(
      {
        search,
        customerId,
        status,
        page,
        limit,
      },
      auth.user
    );

    return NextResponse.json({
      success: true,
      data: result.sales,
      pagination: result.pagination,
      statusCounts: result.statusCounts,
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}

export async function POST(request: Request) {
  if (!validateRequestOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const auth = await requireAuth();
    const body = await request.json();

    const sale = await createSaleDraft(
      {
        customerId: body.customerId,
        notes: body.notes,
        items: body.items,
      },
      auth.user
    );

    return NextResponse.json({ success: true, data: sale }, { status: 201 });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
