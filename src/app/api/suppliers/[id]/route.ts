import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import {
  getSupplierById,
  updateSupplier,
  deactivateSupplier,
  reactivateSupplier,
} from "@/services/supplier.service";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// /api/suppliers/[id] — Single Supplier Details & Update Endpoints
// =============================================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const supplier = await getSupplierById(id, auth.user);
    return NextResponse.json({ success: true, data: supplier });
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

    if (body.action === "DEACTIVATE") {
      const supplier = await deactivateSupplier(id, auth.user);
      return NextResponse.json({ success: true, data: supplier, message: "Supplier deactivated." });
    }

    if (body.action === "REACTIVATE") {
      const supplier = await reactivateSupplier(id, auth.user);
      return NextResponse.json({ success: true, data: supplier, message: "Supplier reactivated." });
    }

    const updated = await updateSupplier(
      id,
      {
        name: body.name,
        contactPerson: body.contactPerson,
        phoneNumber: body.phoneNumber,
        whatsappNumber: body.whatsappNumber,
        gstNumber: body.gstNumber,
        address: body.address,
        notes: body.notes,
      },
      auth.user
    );

    return NextResponse.json({ success: true, data: updated, message: "Supplier updated." });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
