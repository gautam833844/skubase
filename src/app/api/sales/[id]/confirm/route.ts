import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { confirmSale } from "@/services/sale.service";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// POST /api/sales/[id]/confirm — Sale Finalization & Inventory Deduction Endpoint
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

    const completedSale = await confirmSale(id, auth.user);

    return NextResponse.json({
      success: true,
      data: completedSale,
      message: `Sale ${completedSale.invoiceNumber} confirmed successfully and inventory deducted.`,
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
