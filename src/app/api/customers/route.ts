import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { listCustomers, createCustomer } from "@/services/customer.service";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// /api/customers — Customer Directory & Creation API
// =============================================================================

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") ?? undefined;
    const status = (searchParams.get("status") as "ACTIVE" | "INACTIVE" | "ALL") ?? "ACTIVE";
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const result = await listCustomers(
      {
        search,
        status,
        page,
        limit,
      },
      auth.user
    );

    return NextResponse.json({
      success: true,
      data: result.customers,
      pagination: result.pagination,
      metrics: result.metrics,
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}

export async function POST(request: Request) {
  if (!validateRequestOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const auth = await requireAuth();
    const body = await request.json();

    const customer = await createCustomer(
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

    return NextResponse.json({ success: true, data: customer }, { status: 201 });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
