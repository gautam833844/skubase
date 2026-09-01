import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import {
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
} from "@/services/purchase.service";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// /api/purchases/[id] — Single Purchase Order Detail & Status Update
// =============================================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const order = await getPurchaseOrderById(id, auth.user);
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}

export async function PATCH(
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

    if (!body.status) {
      return NextResponse.json({ success: false, error: "Status is required." }, { status: 400 });
    }

    const updated = await updatePurchaseOrderStatus(id, body.status, auth.user);
    return NextResponse.json({
      success: true,
      data: updated,
      message: `Purchase order status updated to ${body.status}.`,
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
