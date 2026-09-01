import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { getSaleWarrantyEligibility, createWarrantyClaim } from "@/services/warranty.service";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// /api/sales/[id]/warranty — Sale Warranty Eligibility & Claim Creation
// =============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const data = await getSaleWarrantyEligibility(id, auth.user);

    return NextResponse.json({
      success: true,
      data,
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

    const claim = await createWarrantyClaim(
      {
        ...body,
        saleId: id,
      },
      auth.user
    );

    return NextResponse.json(
      {
        success: true,
        data: claim,
      },
      { status: 201 }
    );
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
