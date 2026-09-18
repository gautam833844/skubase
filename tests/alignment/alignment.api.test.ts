import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getBills, POST as createBill, DELETE as deleteBills } from "@/app/api/alignment/route";
import { GET as getSingleBill } from "@/app/api/alignment/[id]/route";
import { POST as voidBillRoute } from "@/app/api/alignment/[id]/void/route";
import { GET as getPdf } from "@/app/api/alignment/[id]/pdf/route";
import * as authContext from "@/lib/auth/context";
import type { AuthenticatedUserContext } from "@/lib/auth/session";
import * as alignmentService from "@/services/alignment.service";
import { AlignmentDocType, AlignmentBillStatus } from "@prisma/client";

vi.mock("@/lib/auth/context");
vi.mock("@/services/alignment.service");

describe("Alignment Billing API Route Tests", () => {
  const mockUser = {
    user: { id: "user-1", role: "ADMIN_OWNER" as const, isActive: true },
    session: { id: "s-1", tokenHash: "token", expiresAt: new Date(), userId: "user-1", createdAt: new Date() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authContext, "requireAuth").mockResolvedValue(mockUser as unknown as AuthenticatedUserContext);
  });

  it("GET /api/alignment returns paginated bills list", async () => {
    vi.spyOn(alignmentService, "listAlignmentBills").mockResolvedValue({
      bills: [
        {
          id: "aln-1",
          billNumber: "ALN-1001",
          documentType: AlignmentDocType.BILL,
          date: new Date().toISOString(),
          customerId: null,
          customerName: "Ramesh",
          phoneNumber: null,
          vehicleNumber: "TN01AB1234",
          kilometers: 40000,
          totalAmount: "450.00",
          status: AlignmentBillStatus.COMPLETED,
          notes: null,
          paymentMode: "CASH",
          paidAmount: "450.00",
          createdById: "user-1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [],
        },
      ],
      pagination: { page: 1, limit: 50, totalCount: 1, totalPages: 1 },
    });

    const req = new Request("http://localhost:3000/api/alignment?search=Ramesh");
    const res = await getBills(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.length).toBe(1);
    expect(data.data[0].billNumber).toBe("ALN-1001");
  });

  it("POST /api/alignment creates a bill with valid origin", async () => {
    vi.spyOn(alignmentService, "createAlignmentBill").mockResolvedValue({
      id: "aln-1",
      billNumber: "ALN-1001",
      documentType: AlignmentDocType.BILL,
      date: new Date().toISOString(),
      customerId: null,
      customerName: "Ramesh",
      phoneNumber: null,
      vehicleNumber: "TN01AB1234",
      kilometers: 40000,
      totalAmount: "450.00",
      paymentMode: "CASH",
      paidAmount: "450.00",
      status: AlignmentBillStatus.COMPLETED,
      notes: null,
      createdById: "user-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
    });

    const req = new Request("http://localhost:3000/api/alignment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        documentType: "BILL",
        customerName: "Ramesh",
        vehicleNumber: "TN01AB1234",
        paymentMode: "CASH",
        paidAmount: 450,
        items: [],
      }),
    });

    const res = await createBill(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.billNumber).toBe("ALN-1001");
  });

  it("POST /api/alignment creates a bill with additional custom service items", async () => {
    vi.spyOn(alignmentService, "createAlignmentBill").mockResolvedValue({
      id: "aln-2",
      billNumber: "ALN-1002",
      documentType: AlignmentDocType.BILL,
      date: new Date().toISOString(),
      customerId: null,
      customerName: "Suresh",
      phoneNumber: null,
      vehicleNumber: "KA01CD5678",
      kilometers: 25000,
      totalAmount: "850.00",
      paymentMode: "UPI",
      paidAmount: "850.00",
      status: AlignmentBillStatus.COMPLETED,
      notes: null,
      createdById: "user-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [
        {
          id: "item-1",
          displayOrder: 1,
          particular: "Wheel Alignment 3D",
          rate: "450.00",
          quantity: "1.00",
          amount: "450.00",
        },
        {
          id: "item-12",
          displayOrder: 12,
          particular: "Nitrogen Gas Top-up",
          rate: "100.00",
          quantity: "4.00",
          amount: "400.00",
        },
      ],
    });

    const req = new Request("http://localhost:3000/api/alignment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        documentType: "BILL",
        customerName: "Suresh",
        vehicleNumber: "KA01CD5678",
        items: [
          { displayOrder: 1, particular: "Wheel Alignment 3D", rate: 450, quantity: 1 },
          { displayOrder: 12, particular: "Nitrogen Gas Top-up", rate: 100, quantity: 4 },
        ],
      }),
    });

    const res = await createBill(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.items).toHaveLength(2);
    expect(data.data.items[1].particular).toBe("Nitrogen Gas Top-up");
  });

  it("GET /api/alignment/[id] returns single bill details", async () => {
    vi.spyOn(alignmentService, "getAlignmentBillById").mockResolvedValue({
      id: "aln-1",
      billNumber: "ALN-1001",
      documentType: AlignmentDocType.BILL,
      date: new Date().toISOString(),
      customerId: null,
      customerName: "Ramesh",
      phoneNumber: null,
      vehicleNumber: "TN01AB1234",
      kilometers: 40000,
      totalAmount: "450.00",
      paymentMode: "CASH",
      paidAmount: "450.00",
      status: AlignmentBillStatus.COMPLETED,
      notes: null,
      createdById: "user-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
    });

    const req = new Request("http://localhost:3000/api/alignment/aln-1");
    const res = await getSingleBill(req, { params: Promise.resolve({ id: "aln-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe("aln-1");
  });

  it("POST /api/alignment/[id]/void voids a bill", async () => {
    vi.spyOn(alignmentService, "voidAlignmentBill").mockResolvedValue({
      id: "aln-1",
      billNumber: "ALN-1001",
      documentType: AlignmentDocType.BILL,
      date: new Date().toISOString(),
      customerId: null,
      customerName: "Ramesh",
      phoneNumber: null,
      vehicleNumber: "TN01AB1234",
      kilometers: 40000,
      totalAmount: "450.00",
      paymentMode: "CASH",
      paidAmount: "450.00",
      status: AlignmentBillStatus.VOIDED,
      notes: null,
      createdById: "user-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
    });

    const req = new Request("http://localhost:3000/api/alignment/aln-1/void", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });
    const res = await voidBillRoute(req, { params: Promise.resolve({ id: "aln-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.status).toBe(AlignmentBillStatus.VOIDED);
  });

  it("DELETE /api/alignment permanently deletes selected documents for Admin", async () => {
    vi.spyOn(alignmentService, "deleteAlignmentBills").mockResolvedValue({
      count: 2,
      deletedIds: ["aln-1", "aln-2"],
    });

    const req = new Request("http://localhost:3000/api/alignment", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ ids: ["aln-1", "aln-2"] }),
    });

    const res = await deleteBills(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.count).toBe(2);
    expect(alignmentService.deleteAlignmentBills).toHaveBeenCalledWith(["aln-1", "aln-2"], mockUser.user);
  });

  it("DELETE /api/alignment rejects non-admin users with 403", async () => {
    vi.spyOn(authContext, "requireAuth").mockResolvedValue({
      user: { id: "staff-1", role: "STAFF" as const, isActive: true },
      session: { id: "s-2", tokenHash: "token2", expiresAt: new Date(), userId: "staff-1", createdAt: new Date() },
    } as unknown as AuthenticatedUserContext);

    const req = new Request("http://localhost:3000/api/alignment", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ ids: ["aln-1"] }),
    });

    const res = await deleteBills(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Only administrators");
  });

  it("DELETE /api/alignment rejects invalid CSRF origin", async () => {
    const req = new Request("http://localhost:3000/api/alignment", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        host: "localhost:3000",
        origin: "http://malicious-site.com",
      },
      body: JSON.stringify({ ids: ["aln-1"] }),
    });

    const res = await deleteBills(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Invalid request origin.");
  });

  it("GET /api/alignment/[id]/pdf returns binary PDF stream with headers", async () => {
    vi.spyOn(alignmentService, "getAlignmentBillById").mockResolvedValue({
      id: "aln-1",
      billNumber: "ALN-1001",
      documentType: AlignmentDocType.BILL,
      date: new Date().toISOString(),
      customerId: null,
      customerName: "Ramesh",
      phoneNumber: null,
      vehicleNumber: "TN01AB1234",
      kilometers: 40000,
      totalAmount: "450.00",
      paymentMode: "CASH",
      paidAmount: "450.00",
      status: AlignmentBillStatus.COMPLETED,
      notes: null,
      createdById: "user-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
    });

    const dummyPdfBuffer = new Uint8Array([37, 80, 68, 70]); // %PDF
    vi.spyOn(alignmentService, "generateAlignmentPdf").mockResolvedValue(dummyPdfBuffer);

    const req = new Request("http://localhost:3000/api/alignment/aln-1/pdf");
    const res = await getPdf(req, { params: Promise.resolve({ id: "aln-1" }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("ALN-1001_Ramesh.pdf");
  });
});
