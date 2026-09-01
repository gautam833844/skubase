import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { listPurchaseOrders, createPurchaseOrder } from "@/services/purchase.service";
import { getUserMessage, isAppError } from "@/lib/errors";
import type { PurchaseOrderStatus } from "@prisma/client";

// =============================================================================
// /api/purchases — Purchase Order List & Creation Endpoints
// =============================================================================

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") ?? undefined;
    const supplierId = searchParams.get("supplierId") ?? undefined;
    const status = (searchParams.get("status") as PurchaseOrderStatus | "ALL") ?? undefined;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const result = await listPurchaseOrders(
      {
        search,
        supplierId,
        status,
        page,
        limit,
      },
      auth.user
    );

    return NextResponse.json({
      success: true,
      data: result.orders,
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

    const order = await createPurchaseOrder(
      {
        supplierId: body.supplierId,
        expectedDate: body.expectedDate,
        notes: body.notes,
        items: body.items,
      },
      auth.user
    );

    return NextResponse.json({ success: true, data: order }, { status: 201 });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
