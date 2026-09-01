import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { getSaleReceipt, generateReceiptPdf } from "@/services/receipt.service";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// /api/sales/[id]/receipt/pdf — Sale Receipt Binary PDF Download Endpoint
// =============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const receipt = await getSaleReceipt(id, auth.user);
    const pdfBuffer = await generateReceiptPdf(receipt);

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Receipt-${receipt.invoiceNumber}.pdf"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
