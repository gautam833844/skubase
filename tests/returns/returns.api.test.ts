import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/sales/[id]/returns/route";
import * as authContext from "@/lib/auth/context";
import * as returnService from "@/services/return.service";
import * as csrf from "@/lib/auth/csrf";

vi.mock("@/lib/auth/context");
vi.mock("@/services/return.service");
vi.mock("@/lib/auth/csrf");

describe("Sales Returns API Routes (/api/sales/[id]/returns)", () => {
  const mockAdminUser = {
    session: { id: "session-1", expiresAt: new Date() },
    user: {
      id: "admin-1",
      fullName: "Admin Owner",
      email: "admin@skubase.com",
      username: "admin",
      role: "ADMIN_OWNER" as const,
      isActive: true,
    },
  };

  const mockReturnView: returnService.SaleReturnView = {
    id: "ret-1",
    returnNumber: "RET-1001",
    saleId: "sale-1",
    saleInvoiceNumber: "SALE-1001",
    customerId: "cust-1",
    customerName: "Ramesh Sharma",
    returnDate: new Date().toISOString(),
    totalAmount: "5000.00",
    refundAmount: "0.00",
    status: "COMPLETED",
    refundStatus: "PENDING",
    reason: "Wrong size",
    notes: null,
    createdBy: { fullName: "Admin Owner", username: "admin" },
    items: [
      {
        id: "item-1",
        saleItemId: "si-1",
        productId: "prod-1",
        brand: "Apollo",
        size: "205/55 R16",
        pattern: "Alnac 4G",
        quantity: 1,
        unitPrice: "5000.00",
        totalPrice: "5000.00",
        condition: "SELLABLE",
        reason: null,
      },
    ],
    createdAt: new Date().toISOString(),
  };

  const mockReturnableItems: returnService.SaleReturnableItemView[] = [
    {
      saleItemId: "si-1",
      productId: "prod-1",
      brand: "Apollo",
      size: "205/55 R16",
      pattern: "Alnac 4G",
      soldQuantity: 4,
      alreadyReturnedQuantity: 0,
      returnableQuantity: 4,
      unitPrice: "5000.00",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authContext.requireAuth).mockResolvedValue(mockAdminUser);
    vi.mocked(csrf.validateRequestOrigin).mockReturnValue(true);
  });

  describe("GET /api/sales/[id]/returns", () => {
    it("returns list of returns and returnable items for the sale", async () => {
      vi.mocked(returnService.getSaleReturns).mockResolvedValue([mockReturnView]);
      vi.mocked(returnService.getSaleReturnableItems).mockResolvedValue(mockReturnableItems);

      const request = new Request("http://localhost:3000/api/sales/sale-1/returns");
      const response = await GET(request, { params: Promise.resolve({ id: "sale-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.returns).toHaveLength(1);
      expect(data.data.returnableItems).toHaveLength(1);
      expect(data.data.returns[0].returnNumber).toBe("RET-1001");
    });
  });

  describe("POST /api/sales/[id]/returns", () => {
    it("creates a sales return successfully with CSRF validation", async () => {
      vi.mocked(returnService.createSaleReturn).mockResolvedValue(mockReturnView);

      const request = new Request("http://localhost:3000/api/sales/sale-1/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ saleItemId: "si-1", quantity: 1, condition: "SELLABLE" }],
          reason: "Wrong size",
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sale-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.returnNumber).toBe("RET-1001");
      expect(csrf.validateRequestOrigin).toHaveBeenCalled();
    });
  });
});
