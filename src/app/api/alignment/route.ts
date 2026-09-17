import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { listAlignmentBills, createAlignmentBill, deleteAlignmentBills } from "@/services/alignment.service";
import { getUserMessage, isAppError } from "@/lib/errors";
import type { AlignmentDocType, AlignmentBillStatus } from "@prisma/client";

// =============================================================================
// /api/alignment — Alignment Bills List, Creation & Deletion API
// =============================================================================

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") ?? undefined;
    const customerId = searchParams.get("customerId") ?? undefined;
    const documentType = (searchParams.get("documentType") as AlignmentDocType | "ALL") ?? undefined;
    const status = (searchParams.get("status") as AlignmentBillStatus | "ALL") ?? undefined;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const result = await listAlignmentBills(
      {
        search,
        customerId,
        documentType,
        status,
        page,
        limit,
      },
      auth.user
    );

    return NextResponse.json({
      success: true,
      data: result.bills,
      pagination: result.pagination,
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

    const bill = await createAlignmentBill(
      {
        documentType: body.documentType,
        customerId: body.customerId,
        customerName: body.customerName,
        phoneNumber: body.phoneNumber,
        vehicleNumber: body.vehicleNumber,
        kilometers: body.kilometers,
        date: body.date,
        notes: body.notes,
        items: body.items,
      },
      auth.user
    );

    return NextResponse.json({ success: true, data: bill }, { status: 201 });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}

export async function DELETE(request: Request) {
  if (!validateRequestOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const auth = await requireAuth();
    if (auth.user.role !== "ADMIN_OWNER") {
      return NextResponse.json(
        { success: false, error: "Only administrators can permanently delete alignment documents." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const ids = Array.isArray(body?.ids) ? body.ids : (body?.id ? [body.id] : []);

    const result = await deleteAlignmentBills(ids, auth.user);

    return NextResponse.json({
      success: true,
      data: result,
      message: `Successfully deleted ${result.count} alignment document(s).`,
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: userMessage }, { status: statusCode });
  }
}
