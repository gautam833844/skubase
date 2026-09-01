import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { listInventoryMovements } from "@/services/inventory.service";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// GET /api/inventory/movements — Inventory Ledger History Endpoint
// =============================================================================

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(request.url);

    const productId = searchParams.get("productId") ?? undefined;
    const actorId = searchParams.get("actorId") ?? undefined;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const result = await listInventoryMovements(
      {
        productId,
        actorId,
        page,
        limit,
      },
      auth.user
    );

    return NextResponse.json({
      success: true,
      data: result.movements,
      pagination: result.pagination,
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
