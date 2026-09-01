import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { recordPayment, getSalePayments } from "@/services/payment.service";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// /api/sales/[id]/payments — Payment Recording & History Endpoints
// =============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const details = await getSalePayments(id, auth.user);

    return NextResponse.json({
      success: true,
      data: details,
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
  if (!validateRequestOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const auth = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const result = await recordPayment(
      {
        saleId: id,
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        referenceNumber: body.referenceNumber,
        notes: body.notes,
      },
      auth.user
    );

    return NextResponse.json({
      success: true,
      data: result.payment,
      paymentStatus: result.paymentStatus,
      totalPaid: result.totalPaid,
      remainingBalance: result.remainingBalance,
      message: `Payment of ₹${Number(result.payment.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })} recorded successfully.`,
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
