import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import {
  getProductById,
  updateProduct,
  deactivateProduct,
  reactivateProduct,
} from "@/services/inventory.service";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// /api/inventory/products/[id] — Single Product Retrieval & Update Endpoints
// =============================================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const product = await getProductById(id, auth.user);
    return NextResponse.json({ success: true, data: product });
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
      const product = await deactivateProduct(id, auth.user);
      return NextResponse.json({ success: true, data: product, message: "Product deactivated." });
    }

    if (body.action === "REACTIVATE") {
      const product = await reactivateProduct(id, auth.user);
      return NextResponse.json({ success: true, data: product, message: "Product reactivated." });
    }

    const updated = await updateProduct(
      id,
      {
        brand: body.brand,
        size: body.size,
        pattern: body.pattern,
        unitPrice: body.unitPrice,
        minStockAlert: body.minStockAlert,
        notes: body.notes,
      },
      auth.user
    );

    return NextResponse.json({ success: true, data: updated, message: "Product updated." });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
