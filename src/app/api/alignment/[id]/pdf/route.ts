import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { generateAlignmentPdf, getAlignmentBillById } from "@/services/alignment.service";
import { getUserMessage, isAppError } from "@/lib/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const bill = await getAlignmentBillById(id, auth.user);
    const pdfBuffer = await generateAlignmentPdf(id, auth.user);

    const filename = `${bill.billNumber}_${bill.customerName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
