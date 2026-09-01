import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { receivePurchaseOrder } from "@/services/purchase.service";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// POST /api/purchases/[id]/receive — Goods Receiving Endpoint
// =============================================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateRequestOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const auth = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const result = await receivePurchaseOrder(
      {
        purchaseOrderId: id,
        supplierInvoiceNo: body.supplierInvoiceNo,
        notes: body.notes,
        items: body.items,
      },
      auth.user
    );

    return NextResponse.json({
      success: true,
      data: result.receipt,
      receiptNumber: result.receiptNumber,
      poStatus: result.poStatus,
      message: result.message,
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
