import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { listWarrantyClaims, createWarrantyClaim } from "@/services/warranty.service";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { getUserMessage, isAppError } from "@/lib/errors";
import type { ClaimStatus } from "@prisma/client";

// =============================================================================
// /api/warranty — Warranty Claims Collection API Routes
// =============================================================================

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") as ClaimStatus | null;
    const search = searchParams.get("search") || undefined;
    const saleId = searchParams.get("saleId") || undefined;
    const customerId = searchParams.get("customerId") || undefined;
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 25;

    const result = await listWarrantyClaims(
      {
        status: status || undefined,
        search,
        saleId,
        customerId,
        page,
        limit,
      },
      auth.user
    );

    return NextResponse.json({
      success: true,
      data: result.claims,
      metrics: result.metrics,
      pagination: result.pagination,
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    validateRequestOrigin(request);

    const body = await request.json();
    const claim = await createWarrantyClaim(body, auth.user);

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
