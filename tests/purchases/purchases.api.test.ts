import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getSuppliers, POST as createSupplierRoute } from "@/app/api/suppliers/route";
import { GET as getSupplierByIdRoute, PATCH as patchSupplierRoute } from "@/app/api/suppliers/[id]/route";
import { GET as getPurchases, POST as createPurchaseRoute } from "@/app/api/purchases/route";
import { POST as receivePurchaseRoute } from "@/app/api/purchases/[id]/receive/route";
import { GET as getReceiptsRoute } from "@/app/api/purchases/receipts/route";
import * as supplierService from "@/services/supplier.service";
import * as purchaseService from "@/services/purchase.service";
import * as authContext from "@/lib/auth/context";

vi.mock("@/services/supplier.service");
vi.mock("@/services/purchase.service");
vi.mock("@/lib/auth/context");

describe("Supplier & Purchase API Route Handlers", () => {
  const mockAdminUser = {
    session: { id: "sess-1", expiresAt: new Date() },
    user: {
      id: "admin-1",
      fullName: "Admin Owner",
      email: "owner@skubase.com",
      username: "owner",
      role: "ADMIN_OWNER" as const,
      isActive: true,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authContext.requireAuth).mockResolvedValue(mockAdminUser);
  });

  describe("GET & POST /api/suppliers", () => {
    it("returns supplier list", async () => {
      vi.mocked(supplierService.listSuppliers).mockResolvedValue({
        suppliers: [{ id: "s-1", name: "Metro", isActive: true }] as unknown as Awaited<ReturnType<typeof supplierService.listSuppliers>>["suppliers"],
        pagination: { page: 1, limit: 50, totalCount: 1, totalPages: 1 },
        metrics: { totalActiveSuppliers: 1, totalSuppliers: 1 },
      });

      const request = new Request("http://localhost:3000/api/suppliers?search=Metro");
      const response = await getSuppliers(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
    });

    it("creates supplier with valid origin", async () => {
      vi.mocked(supplierService.createSupplier).mockResolvedValue({
        id: "s-new",
        name: "Apollo Agency",
        isActive: true,
      } as unknown as Awaited<ReturnType<typeof supplierService.createSupplier>>);

      const request = new Request("http://localhost:3000/api/suppliers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "Apollo Agency" }),
      });

      const response = await createSupplierRoute(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe("Apollo Agency");
    });
  });

  describe("GET & PATCH /api/suppliers/[id]", () => {
    it("retrieves supplier details", async () => {
      vi.mocked(supplierService.getSupplierById).mockResolvedValue({
        id: "s-1",
        name: "Metro",
        isActive: true,
        purchaseOrders: [],
        purchaseReceipts: [],
      } as unknown as Awaited<ReturnType<typeof supplierService.getSupplierById>>);

      const request = new Request("http://localhost:3000/api/suppliers/s-1");
      const response = await getSupplierByIdRoute(request, { params: Promise.resolve({ id: "s-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("updates supplier details", async () => {
      vi.mocked(supplierService.updateSupplier).mockResolvedValue({
        id: "s-1",
        name: "Metro Updated",
        isActive: true,
      } as unknown as Awaited<ReturnType<typeof supplierService.updateSupplier>>);

      const request = new Request("http://localhost:3000/api/suppliers/s-1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "Metro Updated" }),
      });

      const response = await patchSupplierRoute(request, { params: Promise.resolve({ id: "s-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe("GET & POST /api/purchases", () => {
    it("returns purchase orders list", async () => {
      vi.mocked(purchaseService.listPurchaseOrders).mockResolvedValue({
        orders: [
          {
            id: "po-1",
            poNumber: "PO-1001",
            status: "ORDERED",
            summary: { totalOrdered: 4, totalReceived: 0, remaining: 4 },
          },
        ] as unknown as Awaited<ReturnType<typeof purchaseService.listPurchaseOrders>>["orders"],
        pagination: { page: 1, limit: 50, totalCount: 1, totalPages: 1 },
        statusCounts: { ORDERED: 1 },
      });

      const request = new Request("http://localhost:3000/api/purchases");
      const response = await getPurchases(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
    });

    it("creates purchase order", async () => {
      vi.mocked(purchaseService.createPurchaseOrder).mockResolvedValue({
        id: "po-1",
        poNumber: "PO-1001",
        status: "ORDERED",
        items: [],
      } as unknown as Awaited<ReturnType<typeof purchaseService.createPurchaseOrder>>);

      const request = new Request("http://localhost:3000/api/purchases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          supplierId: "sup-1",
          items: [{ productId: "p-1", quantityOrdered: 4 }],
        }),
      });

      const response = await createPurchaseRoute(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.poNumber).toBe("PO-1001");
    });
  });

  describe("POST /api/purchases/[id]/receive", () => {
    it("processes goods receiving", async () => {
      vi.mocked(purchaseService.receivePurchaseOrder).mockResolvedValue({
        receipt: { id: "pr-1", receiptNumber: "PR-1001" } as unknown as Awaited<ReturnType<typeof purchaseService.receivePurchaseOrder>>["receipt"],
        receiptNumber: "PR-1001",
        poStatus: "COMPLETED",
        message: "Successfully received goods.",
      });

      const request = new Request("http://localhost:3000/api/purchases/po-1/receive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          items: [{ purchaseOrderItemId: "poi-1", productId: "p-1", quantityReceived: 4 }],
        }),
      });

      const response = await receivePurchaseRoute(request, { params: Promise.resolve({ id: "po-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.receiptNumber).toBe("PR-1001");
    });
  });

  describe("GET /api/purchases/receipts", () => {
    it("returns purchase receipts ledger", async () => {
      vi.mocked(purchaseService.listPurchaseReceipts).mockResolvedValue({
        receipts: [
          { id: "pr-1", receiptNumber: "PR-1001" },
        ] as unknown as Awaited<ReturnType<typeof purchaseService.listPurchaseReceipts>>["receipts"],
        pagination: { page: 1, limit: 50, totalCount: 1, totalPages: 1 },
      });

      const request = new Request("http://localhost:3000/api/purchases/receipts");
      const response = await getReceiptsRoute(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
    });
  });
});
