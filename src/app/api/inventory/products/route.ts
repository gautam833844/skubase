import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { listProducts, createProduct } from "@/services/inventory.service";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// /api/inventory/products — Product List & Creation Endpoints
// =============================================================================

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") ?? undefined;
    const brand = searchParams.get("brand") ?? undefined;
    const size = searchParams.get("size") ?? undefined;
    const pattern = searchParams.get("pattern") ?? undefined;
    const status = (searchParams.get("status") as "ACTIVE" | "INACTIVE" | "ALL") ?? "ACTIVE";
    const lowStockOnly = searchParams.get("lowStockOnly") === "true";
    const sortBy = (searchParams.get("sortBy") as "brand" | "size" | "quantityOnHand" | "unitPrice") ?? "brand";
    const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") ?? "asc";
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const result = await listProducts(
      {
        search,
        brand,
        size,
        pattern,
        status,
        lowStockOnly,
        sortBy,
        sortOrder,
        page,
        limit,
      },
      auth.user
    );

    return NextResponse.json({
      success: true,
      data: result.products,
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

    const product = await createProduct(
      {
        brand: body.brand,
        size: body.size,
        pattern: body.pattern,
        unitPrice: body.unitPrice,
        averageCostPrice: body.averageCostPrice,
        minStockAlert: body.minStockAlert,
        notes: body.notes,
        initialQuantity: body.initialQuantity,
        initialReason: body.initialReason,
      },
      auth.user
    );

    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;

    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
