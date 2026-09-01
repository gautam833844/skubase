import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { listPurchaseReceipts } from "@/services/purchase.service";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// GET /api/purchases/receipts — Purchase Receipt Ledger History
// =============================================================================

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(request.url);

    const purchaseOrderId = searchParams.get("purchaseOrderId") ?? undefined;
    const supplierId = searchParams.get("supplierId") ?? undefined;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const result = await listPurchaseReceipts(
      {
        purchaseOrderId,
        supplierId,
        page,
        limit,
      },
      auth.user
    );

    return NextResponse.json({
      success: true,
      data: result.receipts,
      pagination: result.pagination,
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
