import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { getSaleById, updateSaleDraft } from "@/services/sale.service";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// /api/sales/[id] — Single Sale Details & Draft Update API
// =============================================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const sale = await getSaleById(id, auth.user);
    return NextResponse.json({ success: true, data: sale });
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

    const updated = await updateSaleDraft(
      id,
      {
        customerId: body.customerId,
        notes: body.notes,
        items: body.items,
      },
      auth.user
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Sale draft updated successfully.",
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
