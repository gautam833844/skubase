import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { listSuppliers, createSupplier } from "@/services/supplier.service";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// /api/suppliers — Supplier Directory & Creation Endpoints
// =============================================================================

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") ?? undefined;
    const status = (searchParams.get("status") as "ACTIVE" | "INACTIVE" | "ALL") ?? "ACTIVE";
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const result = await listSuppliers(
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
      data: result.suppliers,
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

    const supplier = await createSupplier(
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

    return NextResponse.json({ success: true, data: supplier }, { status: 201 });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
