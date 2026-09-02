import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { getUserMessage, isAppError } from "@/lib/errors";
import { getDashboardKpis } from "@/services/dashboard.service";

// =============================================================================
// GET /api/dashboard/kpis — Dashboard Business KPIs Endpoint (V1.1)
// =============================================================================

export async function GET() {
  try {
    const auth = await requireAuth();
    const data = await getDashboardKpis(auth.user);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
