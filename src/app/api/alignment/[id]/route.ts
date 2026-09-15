import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { getAlignmentBillById } from "@/services/alignment.service";
import { getUserMessage, isAppError } from "@/lib/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const bill = await getAlignmentBillById(id, auth.user);
    return NextResponse.json({ success: true, data: bill });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
