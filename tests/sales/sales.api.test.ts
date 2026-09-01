import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getCustomers, POST as createCustomerRoute } from "@/app/api/customers/route";
import { GET as getCustomerByIdRoute, PATCH as patchCustomerRoute } from "@/app/api/customers/[id]/route";
import { GET as getSales, POST as createSaleRoute } from "@/app/api/sales/route";
import { GET as getSaleByIdRoute, PATCH as patchSaleRoute } from "@/app/api/sales/[id]/route";
import { POST as confirmSaleRoute } from "@/app/api/sales/[id]/confirm/route";
import * as customerService from "@/services/customer.service";
import * as saleService from "@/services/sale.service";
import * as authContext from "@/lib/auth/context";

vi.mock("@/services/customer.service");
vi.mock("@/services/sale.service");
vi.mock("@/lib/auth/context");

describe("Customer & Sales API Route Handlers", () => {
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

  describe("GET & POST /api/customers", () => {
    it("returns customer list", async () => {
      vi.mocked(customerService.listCustomers).mockResolvedValue({
        customers: [{ id: "c-1", name: "Sunil Sharma", isActive: true }] as unknown as Awaited<ReturnType<typeof customerService.listCustomers>>["customers"],
        pagination: { page: 1, limit: 50, totalCount: 1, totalPages: 1 },
        metrics: { totalActiveCustomers: 1, totalCustomers: 1 },
      });

      const request = new Request("http://localhost:3000/api/customers?search=Sunil");
      const response = await getCustomers(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
    });

    it("creates customer with valid origin", async () => {
      vi.mocked(customerService.createCustomer).mockResolvedValue({
        id: "c-new",
        name: "Ramesh Patel",
        isActive: true,
      } as unknown as Awaited<ReturnType<typeof customerService.createCustomer>>);

      const request = new Request("http://localhost:3000/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "Ramesh Patel", vehicleNumber: "MH02AB1234" }),
      });

      const response = await createCustomerRoute(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe("Ramesh Patel");
    });
  });

  describe("GET & PATCH /api/customers/[id]", () => {
    it("retrieves customer details", async () => {
      vi.mocked(customerService.getCustomerById).mockResolvedValue({
        id: "c-1",
        name: "Sunil Sharma",
        isActive: true,
        sales: [],
        _count: { sales: 0 },
      } as unknown as Awaited<ReturnType<typeof customerService.getCustomerById>>);

      const request = new Request("http://localhost:3000/api/customers/c-1");
      const response = await getCustomerByIdRoute(request, { params: Promise.resolve({ id: "c-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("updates customer details", async () => {
      vi.mocked(customerService.updateCustomer).mockResolvedValue({
        id: "c-1",
        name: "Sunil Sharma Updated",
        isActive: true,
      } as unknown as Awaited<ReturnType<typeof customerService.updateCustomer>>);

      const request = new Request("http://localhost:3000/api/customers/c-1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "Sunil Sharma Updated" }),
      });

      const response = await patchCustomerRoute(request, { params: Promise.resolve({ id: "c-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe("GET & POST /api/sales", () => {
    it("returns sales list", async () => {
      vi.mocked(saleService.listSales).mockResolvedValue({
        sales: [
          {
            id: "sale-1",
            invoiceNumber: "SALE-1001",
            status: "DRAFT",
            itemCount: 1,
            totalQuantity: 4,
          },
        ] as unknown as Awaited<ReturnType<typeof saleService.listSales>>["sales"],
        pagination: { page: 1, limit: 50, totalCount: 1, totalPages: 1 },
        statusCounts: { DRAFT: 1 },
      });

      const request = new Request("http://localhost:3000/api/sales");
      const response = await getSales(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
    });

    it("creates sale draft", async () => {
      vi.mocked(saleService.createSaleDraft).mockResolvedValue({
        id: "sale-1",
        invoiceNumber: "SALE-1001",
        status: "DRAFT",
      } as unknown as Awaited<ReturnType<typeof saleService.createSaleDraft>>);

      const request = new Request("http://localhost:3000/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          customerId: "c-1",
          items: [{ productId: "p-1", quantity: 4 }],
        }),
      });

      const response = await createSaleRoute(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.invoiceNumber).toBe("SALE-1001");
    });
  });

  describe("GET & PATCH /api/sales/[id]", () => {
    it("retrieves sale details", async () => {
      vi.mocked(saleService.getSaleById).mockResolvedValue({
        id: "sale-1",
        invoiceNumber: "SALE-1001",
        status: "DRAFT",
        itemCount: 1,
        totalQuantity: 4,
      } as unknown as Awaited<ReturnType<typeof saleService.getSaleById>>);

      const request = new Request("http://localhost:3000/api/sales/sale-1");
      const response = await getSaleByIdRoute(request, { params: Promise.resolve({ id: "sale-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("updates sale draft", async () => {
      vi.mocked(saleService.updateSaleDraft).mockResolvedValue({
        id: "sale-1",
        invoiceNumber: "SALE-1001",
        status: "DRAFT",
      } as unknown as Awaited<ReturnType<typeof saleService.updateSaleDraft>>);

      const request = new Request("http://localhost:3000/api/sales/sale-1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ notes: "Updated notes" }),
      });

      const response = await patchSaleRoute(request, { params: Promise.resolve({ id: "sale-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe("Sale draft updated successfully.");
    });
  });

  describe("POST /api/sales/[id]/confirm", () => {
    it("confirms sale and deducts inventory", async () => {
      vi.mocked(saleService.confirmSale).mockResolvedValue({
        id: "sale-1",
        invoiceNumber: "SALE-1001",
        status: "COMPLETED",
        totalAmount: "26000.00",
      } as unknown as Awaited<ReturnType<typeof saleService.confirmSale>>);

      const request = new Request("http://localhost:3000/api/sales/sale-1/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
      });

      const response = await confirmSaleRoute(request, { params: Promise.resolve({ id: "sale-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe("COMPLETED");
      expect(data.message).toContain("confirmed successfully");
    });
  });
});
