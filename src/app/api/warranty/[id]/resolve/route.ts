import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { resolveWarrantyClaim } from "@/services/warranty.service";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// /api/warranty/[id]/resolve — Resolve Claim Without Stock Deduction
// =============================================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    validateRequestOrigin(request);

    const { id } = await params;
    const body = await request.json();

    const claim = await resolveWarrantyClaim(id, body, auth.user);

    return NextResponse.json({
      success: true,
      data: claim,
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
