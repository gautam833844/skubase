import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { getUserMessage, isAppError } from "@/lib/errors";
import {
  getStockValuationReport,
  getLowStockAlertsReport,
  getSalesProfitSummaryReport,
  getStockMovementLedgerReport,
} from "@/services/report.service";

// =============================================================================
// /api/reports — Reports & Business Analytics API
// =============================================================================

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "stock";

    if (type === "stock") {
      const brand = searchParams.get("brand") || undefined;
      const data = await getStockValuationReport(auth.user, brand);
      return NextResponse.json({ success: true, data });
    }

    if (type === "low_stock") {
      const data = await getLowStockAlertsReport(auth.user);
      return NextResponse.json({ success: true, data });
    }

    if (type === "sales") {
      const startDate = searchParams.get("startDate") || undefined;
      const endDate = searchParams.get("endDate") || undefined;
      const data = await getSalesProfitSummaryReport(auth.user, { startDate, endDate });
      return NextResponse.json({ success: true, data });
    }

    if (type === "movements") {
      const startDate = searchParams.get("startDate") || undefined;
      const endDate = searchParams.get("endDate") || undefined;
      const movementType = searchParams.get("movementType") || undefined;
      const productId = searchParams.get("productId") || undefined;
      const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
      const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;

      const data = await getStockMovementLedgerReport(auth.user, {
        startDate,
        endDate,
        movementType,
        productId,
        page,
        limit,
      });
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json(
      { success: false, error: `Invalid report type requested: ${type}` },
      { status: 400 }
    );
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
