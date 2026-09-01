import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as listClaimsRoute, POST as createClaimRoute } from "@/app/api/warranty/route";
import { GET as getClaimRoute, PATCH as patchClaimRoute } from "@/app/api/warranty/[id]/route";
import { POST as replacementRoute } from "@/app/api/warranty/[id]/replacement/route";
import { POST as resolveRoute } from "@/app/api/warranty/[id]/resolve/route";
import { GET as getSaleWarrantyRoute, POST as createSaleWarrantyRoute } from "@/app/api/sales/[id]/warranty/route";
import * as warrantyService from "@/services/warranty.service";
import type { WarrantyClaimView, WarrantyClaimSummaryView } from "@/lib/types/warranty";
import * as authContext from "@/lib/auth/context";
import * as csrf from "@/lib/auth/csrf";

vi.mock("@/lib/auth/context");
vi.mock("@/services/warranty.service");
vi.mock("@/lib/auth/csrf");

describe("Warranty Claims API Route Handlers", () => {
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

  const mockClaimView: WarrantyClaimView = {
    id: "claim-1",
    claimNumber: "WAR-1001",
    saleId: "sale-1",
    saleInvoiceNumber: "SALE-1001",
    saleDate: "2026-09-01T10:00:00.000Z",
    saleItemId: "item-1",
    productId: "prod-1",
    productBrand: "Apollo",
    productSize: "205/55 R16",
    productPattern: "Alnac 4G",
    productSoldPrice: "6500.00",
    customerId: "cust-1",
    customerName: "Sunil Sharma",
    customerPhone: "9876543210",
    customerVehicle: "MH02CD1234",
    supplierId: null,
    supplierName: null,
    claimType: "WARRANTY_DEFECT",
    status: "SUBMITTED",
    quantity: 1,
    issueDescription: "Sidewall bulge detected",
    dotSerialCode: "DOT 4B08",
    inspectionNotes: "Confirmed bubble",
    externalClaimReference: null,
    submittedAt: null,
    decisionAt: null,
    decisionNotes: null,
    resolutionType: null,
    resolutionNotes: null,
    resolvedAt: null,
    replacementProductId: null,
    replacementProductBrand: null,
    replacementProductSize: null,
    replacementProductPattern: null,
    replacementQuantity: 0,
    createdById: "admin-1",
    createdByName: "Admin Owner",
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authContext.requireAuth).mockResolvedValue(mockAdminUser);
    vi.mocked(csrf.validateRequestOrigin).mockReturnValue(true);
  });

  describe("/api/warranty", () => {
    it("GET /api/warranty returns claims list with metrics and pagination", async () => {
      vi.mocked(warrantyService.listWarrantyClaims).mockResolvedValue({
        claims: [mockClaimView as unknown as WarrantyClaimSummaryView],
        metrics: {
          totalClaims: 1,
          submittedClaims: 1,
          underReviewClaims: 0,
          approvedClaims: 0,
          resolvedClaims: 0,
          rejectedClaims: 0,
        },
        pagination: { page: 1, limit: 25, totalCount: 1, totalPages: 1 },
      });

      const req = new Request("http://localhost:3000/api/warranty?page=1&limit=25");
      const res = await listClaimsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.metrics.totalClaims).toBe(1);
    });

    it("POST /api/warranty creates a new warranty claim", async () => {
      vi.mocked(warrantyService.createWarrantyClaim).mockResolvedValue(mockClaimView);

      const req = new Request("http://localhost:3000/api/warranty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: "sale-1",
          saleItemId: "item-1",
          issueDescription: "Sidewall bulge detected",
        }),
      });

      const res = await createClaimRoute(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.claimNumber).toBe("WAR-1001");
    });
  });

  describe("/api/warranty/[id]", () => {
    it("GET /api/warranty/[id] returns claim details", async () => {
      vi.mocked(warrantyService.getWarrantyClaimById).mockResolvedValue(mockClaimView);

      const req = new Request("http://localhost:3000/api/warranty/claim-1");
      const res = await getClaimRoute(req, { params: Promise.resolve({ id: "claim-1" }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.claimNumber).toBe("WAR-1001");
    });

    it("PATCH /api/warranty/[id] updates claim status", async () => {
      vi.mocked(warrantyService.updateWarrantyClaimStatus).mockResolvedValue({
        ...mockClaimView,
        status: "UNDER_REVIEW",
      });

      const req = new Request("http://localhost:3000/api/warranty/claim-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "UNDER_REVIEW",
          externalClaimReference: "BRAND-REF-100",
        }),
      });

      const res = await patchClaimRoute(req, { params: Promise.resolve({ id: "claim-1" }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.status).toBe("UNDER_REVIEW");
    });
  });

  describe("/api/warranty/[id]/replacement", () => {
    it("POST /api/warranty/[id]/replacement issues replacement and deducts stock", async () => {
      vi.mocked(warrantyService.issueWarrantyReplacement).mockResolvedValue({
        ...mockClaimView,
        status: "RESOLVED",
        resolutionType: "REPLACEMENT_FROM_STOCK",
        replacementQuantity: 1,
      });

      const req = new Request("http://localhost:3000/api/warranty/claim-1/replacement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replacementQuantity: 1 }),
      });

      const res = await replacementRoute(req, { params: Promise.resolve({ id: "claim-1" }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.status).toBe("RESOLVED");
      expect(json.data.resolutionType).toBe("REPLACEMENT_FROM_STOCK");
    });
  });

  describe("/api/warranty/[id]/resolve", () => {
    it("POST /api/warranty/[id]/resolve saves non-stock resolution", async () => {
      vi.mocked(warrantyService.resolveWarrantyClaim).mockResolvedValue({
        ...mockClaimView,
        status: "RESOLVED",
        resolutionType: "CREDIT_NOTE",
      });

      const req = new Request("http://localhost:3000/api/warranty/claim-1/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionType: "CREDIT_NOTE" }),
      });

      const res = await resolveRoute(req, { params: Promise.resolve({ id: "claim-1" }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.status).toBe("RESOLVED");
    });
  });

  describe("/api/sales/[id]/warranty", () => {
    it("GET /api/sales/[id]/warranty returns sale warranty eligibility and claims", async () => {
      vi.mocked(warrantyService.getSaleWarrantyEligibility).mockResolvedValue({
        saleId: "sale-1",
        invoiceNumber: "SALE-1001",
        saleDate: "2026-09-01T10:00:00.000Z",
        customerName: "Sunil Sharma",
        items: [
          {
            saleItemId: "item-1",
            productId: "prod-1",
            brand: "Apollo",
            size: "205/55 R16",
            pattern: "Alnac 4G",
            unitPrice: "6500.00",
            soldQuantity: 2,
            hasActiveClaim: false,
            activeClaimNumber: null,
            activeClaimStatus: null,
          },
        ],
        claims: [],
      });

      const req = new Request("http://localhost:3000/api/sales/sale-1/warranty");
      const res = await getSaleWarrantyRoute(req, { params: Promise.resolve({ id: "sale-1" }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.items).toHaveLength(1);
    });

    it("POST /api/sales/[id]/warranty creates claim against sale", async () => {
      vi.mocked(warrantyService.createWarrantyClaim).mockResolvedValue(mockClaimView);

      const req = new Request("http://localhost:3000/api/sales/sale-1/warranty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleItemId: "item-1",
          issueDescription: "Sidewall bulge detected",
        }),
      });

      const res = await createSaleWarrantyRoute(req, { params: Promise.resolve({ id: "sale-1" }) });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.data.claimNumber).toBe("WAR-1001");
    });
  });
});
