import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { getShopSettings, updateShopSettings } from "@/services/shop.service";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// /api/settings — Shop / Business Settings API Routes
// =============================================================================

export async function GET() {
  try {
    const auth = await requireAuth();
    const settings = await getShopSettings(auth.user);

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAuth();
    validateRequestOrigin(request);

    const body = await request.json();
    const updated = await updateShopSettings(body, auth.user);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
