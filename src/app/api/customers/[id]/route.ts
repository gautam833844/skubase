import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import {
  getCustomerById,
  updateCustomer,
  deactivateCustomer,
  reactivateCustomer,
} from "@/services/customer.service";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// /api/customers/[id] — Single Customer Details & Update API
// =============================================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const customer = await getCustomerById(id, auth.user);
    return NextResponse.json({ success: true, data: customer });
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
      const customer = await deactivateCustomer(id, auth.user);
      return NextResponse.json({ success: true, data: customer, message: "Customer deactivated." });
    }

    if (body.action === "REACTIVATE") {
      const customer = await reactivateCustomer(id, auth.user);
      return NextResponse.json({ success: true, data: customer, message: "Customer reactivated." });
    }

    const updated = await updateCustomer(
      id,
      {
        name: body.name,
        phoneNumber: body.phoneNumber,
        vehicleNumber: body.vehicleNumber,
        vehicleModel: body.vehicleModel,
        address: body.address,
        notes: body.notes,
      },
      auth.user
    );

    return NextResponse.json({ success: true, data: updated, message: "Customer updated." });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
