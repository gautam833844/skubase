import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { getSaleReceipt } from "@/services/receipt.service";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// /api/sales/[id]/receipt — Sale Receipt JSON Endpoint
// =============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const receipt = await getSaleReceipt(id, auth.user);

    return NextResponse.json({
      success: true,
      data: receipt,
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
