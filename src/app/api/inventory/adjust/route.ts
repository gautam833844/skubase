import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { adjustStock } from "@/services/inventory.service";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// POST /api/inventory/adjust — Manual Stock Adjustment Endpoint
// =============================================================================

export async function POST(request: Request) {
  if (!validateRequestOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const auth = await requireAuth();
    const body = await request.json();

    const result = await adjustStock(
      {
        productId: body.productId,
        adjustmentType: body.adjustmentType,
        quantity: body.quantity,
        actualCount: body.actualCount,
        reason: body.reason,
        notes: body.notes,
      },
      auth.user
    );

    return NextResponse.json({
      success: true,
      data: result.product,
      movement: result.movement,
      message: result.message,
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
