import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { createSaleReturn, getSaleReturns, getSaleReturnableItems } from "@/services/return.service";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// /api/sales/[id]/returns — Sales Returns API Routes
// =============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const [returns, returnableItems] = await Promise.all([
      getSaleReturns(id, auth.user),
      getSaleReturnableItems(id, auth.user),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        returns,
        returnableItems,
      },
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    validateRequestOrigin(request);

    const { id } = await params;
    const body = await request.json();

    const saleReturn = await createSaleReturn(
      {
        ...body,
        saleId: id,
      },
      auth.user
    );

    return NextResponse.json({
      success: true,
      data: saleReturn,
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
