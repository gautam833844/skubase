import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/sales/[id]/payments/route";
import * as paymentService from "@/services/payment.service";
import * as authContext from "@/lib/auth/context";
import { Prisma } from "@prisma/client";

vi.mock("@/services/payment.service");
vi.mock("@/lib/auth/context");

describe("Payments API Routes (/api/sales/[id]/payments)", () => {
  const mockUser = {
    id: "user-1",
    username: "staff1",
    fullName: "Staff Member",
    email: "staff1@skubase.local",
    role: "STAFF" as const,
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authContext.requireAuth).mockResolvedValue({
      user: mockUser,
      session: { id: "session-1", expiresAt: new Date() },
    });
  });

  describe("GET /api/sales/[id]/payments", () => {
    it("returns payment details and payment history", async () => {
      vi.mocked(paymentService.getSalePayments).mockResolvedValue({
        saleId: "sale-1",
        invoiceNumber: "SALE-1001",
        saleStatus: "COMPLETED",
        totalAmount: new Prisma.Decimal(20000),
        totalPaid: new Prisma.Decimal(12000),
        remainingBalance: new Prisma.Decimal(8000),
        paymentStatus: "PARTIALLY_PAID",
        payments: [
          {
            id: "pay-1",
            saleId: "sale-1",
            amount: new Prisma.Decimal(12000),
            paymentMethod: "CASH",
            referenceNumber: null,
            paymentDate: new Date().toISOString(),
            notes: "Deposit",
            createdById: "user-1",
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const request = new Request("http://localhost:3000/api/sales/sale-1/payments", {
        method: "GET",
      });

      const response = await GET(request, { params: Promise.resolve({ id: "sale-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.saleId).toBe("sale-1");
    });
  });

  describe("POST /api/sales/[id]/payments", () => {
    it("blocks request with invalid CSRF origin", async () => {
      const request = new Request("http://localhost:3000/api/sales/sale-1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "http://malicious-site.com",
        },
        body: JSON.stringify({
          amount: 5000,
          paymentMethod: "CASH",
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sale-1" }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid request origin.");
    });

    it("records payment successfully with valid CSRF origin", async () => {
      vi.mocked(paymentService.recordPayment).mockResolvedValue({
        payment: {
          id: "pay-1",
          saleId: "sale-1",
          amount: new Prisma.Decimal(5000),
          paymentMethod: "CASH",
          referenceNumber: null,
          paymentDate: new Date(),
          createdById: "user-1",
          createdAt: new Date(),
          notes: null,
          customerOrderId: null,
          createdBy: {
            id: "user-1",
            fullName: "Staff Member",
            username: "staff1",
          },
        },
        paymentStatus: "PARTIALLY_PAID",
        totalPaid: new Prisma.Decimal(5000),
        remainingBalance: new Prisma.Decimal(15000),
      });

      const request = new Request("http://localhost:3000/api/sales/sale-1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          amount: 5000,
          paymentMethod: "CASH",
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sale-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.paymentStatus).toBe("PARTIALLY_PAID");
      expect(data.message).toContain("recorded successfully");
    });
  });
});
