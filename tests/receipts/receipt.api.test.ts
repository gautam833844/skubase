import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getReceiptRoute } from "@/app/api/sales/[id]/receipt/route";
import { GET as getReceiptPdfRoute } from "@/app/api/sales/[id]/receipt/pdf/route";
import * as receiptService from "@/services/receipt.service";
import * as authContext from "@/lib/auth/context";

vi.mock("@/services/receipt.service");
vi.mock("@/lib/auth/context");

describe("Sale Receipt API Routes (/api/sales/[id]/receipt and /pdf)", () => {
  const mockUser = {
    id: "user-1",
    username: "staff1",
    fullName: "Staff Member",
    email: "staff1@skubase.local",
    role: "STAFF" as const,
    isActive: true,
  };

  const mockReceiptData: receiptService.SaleReceiptView = {
    saleId: "sale-1",
    invoiceNumber: "SALE-1001",
    saleDate: new Date().toISOString(),
    status: "COMPLETED",
    isDraft: false,
    documentTitle: "SALE RECEIPT",
    shop: {
      id: "shop-1",
      name: "Skubase Tyre Hub",
      tagline: "Quality Tyres",
      address: "Plot 42, Transport Road, Mumbai",
      phoneNumber: "9876543210",
      email: "shop@skubase.com",
      website: "https://skubase.com",
      gstin: "27ABCDE1234F1Z5",
      billFooter: "Thank you!",
      updatedAt: new Date().toISOString(),
    },
    customer: {
      name: "Vikram Malhotra",
      phoneNumber: "9876543210",
      vehicleNumber: "MH01AB9999",
      vehicleModel: "Honda City",
      address: "Mumbai",
    },
    seller: {
      fullName: "Staff Member",
      username: "staff1",
    },
    items: [
      {
        id: "item-1",
        brand: "Apollo",
        size: "205/55 R16",
        pattern: "Alnac 4G",
        quantity: 2,
        unitPrice: "6500",
        discountAmount: "0",
        totalPrice: "13000",
      },
    ],
    itemCount: 1,
    totalQuantity: 2,
    subtotal: "13000",
    discountAmount: "0",
    totalAmount: "13000",
    totalPaid: "13000",
    remainingBalance: "0",
    paymentStatus: "PAID",
    payments: [],
    notes: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authContext.requireAuth).mockResolvedValue({
      user: mockUser,
      session: { id: "session-1", expiresAt: new Date() },
    });
  });

  describe("GET /api/sales/[id]/receipt", () => {
    it("returns JSON receipt data for authorized user", async () => {
      vi.mocked(receiptService.getSaleReceipt).mockResolvedValue(mockReceiptData);

      const request = new Request("http://localhost:3000/api/sales/sale-1/receipt", {
        method: "GET",
      });

      const response = await getReceiptRoute(request, { params: Promise.resolve({ id: "sale-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.invoiceNumber).toBe("SALE-1001");
      expect(data.data.items[0].brand).toBe("Apollo");
    });
  });

  describe("GET /api/sales/[id]/receipt/pdf", () => {
    it("returns binary PDF stream with application/pdf header and attachment filename", async () => {
      vi.mocked(receiptService.getSaleReceipt).mockResolvedValue(mockReceiptData);
      const fakePdfBuffer = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]); // %PDF-1.4
      vi.mocked(receiptService.generateReceiptPdf).mockResolvedValue(fakePdfBuffer);

      const request = new Request("http://localhost:3000/api/sales/sale-1/receipt/pdf", {
        method: "GET",
      });

      const response = await getReceiptPdfRoute(request, { params: Promise.resolve({ id: "sale-1" }) });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
      expect(response.headers.get("Content-Disposition")).toContain("Receipt-SALE-1001.pdf");
    });
  });
});
