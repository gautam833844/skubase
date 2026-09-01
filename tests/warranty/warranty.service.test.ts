import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createWarrantyClaim,
  getSaleWarrantyEligibility,
  listWarrantyClaims,
  getWarrantyClaimById,
  updateWarrantyClaimStatus,
  issueWarrantyReplacement,
  resolveWarrantyClaim,
} from "@/services/warranty.service";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { AuthActor } from "@/lib/auth/permissions";

const { mockTx } = vi.hoisted(() => {
  const tx = {
    sale: {
      findUnique: vi.fn(),
    },
    warrantyClaim: {
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    inventoryMovement: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
  return { mockTx: tx };
});

vi.mock("@/lib/db", () => {
  return {
    db: {
      sale: {
        findUnique: vi.fn(),
      },
      warrantyClaim: {
        count: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        groupBy: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
        return cb(mockTx);
      }),
    },
  };
});

describe("Warranty Service (src/services/warranty.service.ts)", () => {
  const mockAdmin: AuthActor = { id: "admin-1", role: "ADMIN_OWNER" };
  const mockManager: AuthActor = { id: "mgr-1", role: "MANAGER" };
  const mockStaff: AuthActor = { id: "staff-1", role: "STAFF" };

  const mockProduct = {
    id: "prod-1",
    brand: "Apollo",
    size: "205/55 R16",
    pattern: "Alnac 4G",
    quantityOnHand: 5,
  };

  const mockSaleItem = {
    id: "item-1",
    saleId: "sale-1",
    productId: "prod-1",
    quantity: 2,
    unitPrice: new Prisma.Decimal(6500),
    totalPrice: new Prisma.Decimal(13000),
    product: mockProduct,
    warrantyClaims: [],
  };

  const mockSale = {
    id: "sale-1",
    invoiceNumber: "SALE-1001",
    customerId: "cust-1",
    status: "COMPLETED",
    subtotal: new Prisma.Decimal(13000),
    totalAmount: new Prisma.Decimal(13000),
    createdById: "admin-1",
    saleDate: new Date("2026-09-01T10:00:00Z"),
    customer: { id: "cust-1", name: "Sunil Sharma", phoneNumber: "9876543210", vehicleNumber: "MH02CD1234" },
    items: [mockSaleItem],
    warrantyClaims: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSaleWarrantyEligibility", () => {
    it("returns eligible sale items and existing warranty claims for completed sale", async () => {
      vi.mocked(db.sale.findUnique).mockResolvedValue(mockSale as unknown as Awaited<ReturnType<typeof db.sale.findUnique>>);

      const result = await getSaleWarrantyEligibility("sale-1", mockAdmin);

      expect(result.saleId).toBe("sale-1");
      expect(result.items).toHaveLength(1);
      expect(result.items[0].brand).toBe("Apollo");
      expect(result.items[0].hasActiveClaim).toBe(false);
      expect(result.claims).toHaveLength(0);
    });

    it("rejects eligibility check for DRAFT sales", async () => {
      vi.mocked(db.sale.findUnique).mockResolvedValue({
        ...mockSale,
        status: "DRAFT",
      } as unknown as Awaited<ReturnType<typeof db.sale.findUnique>>);

      await expect(getSaleWarrantyEligibility("sale-1", mockAdmin)).rejects.toThrow(
        "Only COMPLETED sales are eligible"
      );
    });

    it("enforces IDOR for STAFF on sales created by other users", async () => {
      vi.mocked(db.sale.findUnique).mockResolvedValue({
        ...mockSale,
        createdById: "other-user",
      } as unknown as Awaited<ReturnType<typeof db.sale.findUnique>>);

      await expect(getSaleWarrantyEligibility("sale-1", mockStaff)).rejects.toThrow(
        "You cannot view warranty details for this sale"
      );
    });
  });

  describe("createWarrantyClaim", () => {
    it("creates a warranty claim with status SUBMITTED and logs audit event", async () => {
      mockTx.sale.findUnique.mockResolvedValue(mockSale);
      mockTx.warrantyClaim.count.mockResolvedValue(0);
      mockTx.warrantyClaim.findUnique.mockResolvedValue(null);
      mockTx.warrantyClaim.create.mockResolvedValue({
        id: "claim-1",
        claimNumber: "WAR-1001",
        saleId: "sale-1",
        saleItemId: "item-1",
        productId: "prod-1",
        customerId: "cust-1",
        supplierId: null,
        claimType: "WARRANTY_DEFECT",
        status: "SUBMITTED",
        quantity: 1,
        issueDescription: "Sidewall bulge after normal highway drive",
        dotSerialCode: "DOT 4B08",
        inspectionNotes: "Visible bulge, no puncture",
        externalClaimReference: null,
        submittedAt: null,
        decisionAt: null,
        decisionNotes: null,
        resolutionType: null,
        resolutionNotes: null,
        resolvedAt: null,
        replacementProductId: null,
        replacementQuantity: 0,
        createdById: "admin-1",
        createdAt: new Date("2026-09-01T10:00:00Z"),
        updatedAt: new Date("2026-09-01T10:00:00Z"),
        sale: mockSale,
        saleItem: mockSaleItem,
        product: mockProduct,
        customer: mockSale.customer,
        supplier: null,
        createdBy: { fullName: "Admin Owner", username: "admin" },
      });

      const result = await createWarrantyClaim(
        {
          saleId: "sale-1",
          saleItemId: "item-1",
          issueDescription: "Sidewall bulge after normal highway drive",
          dotSerialCode: "DOT 4B08",
          inspectionNotes: "Visible bulge, no puncture",
        },
        mockAdmin
      );

      expect(result.claimNumber).toBe("WAR-1001");
      expect(result.status).toBe("SUBMITTED");
      expect(result.productBrand).toBe("Apollo");

      // Verify audit log
      expect(mockTx.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "WARRANTY_CLAIM_CREATED",
          entityName: "WarrantyClaim",
          entityId: "claim-1",
          actorId: "admin-1",
        }),
      });

      // Verify zero stock changes on claim creation
      expect(mockTx.product.update).not.toHaveBeenCalled();
      expect(mockTx.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it("rejects duplicate active warranty claim on the same sale item", async () => {
      const saleWithActiveClaim = {
        ...mockSale,
        items: [
          {
            ...mockSaleItem,
            warrantyClaims: [
              {
                id: "claim-prev",
                claimNumber: "WAR-1001",
                status: "SUBMITTED",
              },
            ],
          },
        ],
      };

      mockTx.sale.findUnique.mockResolvedValue(saleWithActiveClaim);

      await expect(
        createWarrantyClaim(
          {
            saleId: "sale-1",
            saleItemId: "item-1",
            issueDescription: "Another claim attempt",
          },
          mockAdmin
        )
      ).rejects.toThrow("An active warranty claim (WAR-1001) is already in progress");
    });

    it("rejects claim with empty or too short issue description", async () => {
      await expect(
        createWarrantyClaim(
          {
            saleId: "sale-1",
            saleItemId: "item-1",
            issueDescription: "ab",
          },
          mockAdmin
        )
      ).rejects.toThrow("Issue description is required (min 3 characters)");
    });
  });

  describe("listWarrantyClaims", () => {
    it("returns paginated claims and aggregated status metrics", async () => {
      vi.mocked(db.warrantyClaim.findMany).mockResolvedValue([
        {
          id: "claim-1",
          claimNumber: "WAR-1001",
          saleId: "sale-1",
          saleItemId: "item-1",
          productId: "prod-1",
          customerId: "cust-1",
          supplierId: null,
          claimType: "WARRANTY_DEFECT",
          status: "SUBMITTED",
          quantity: 1,
          issueDescription: "Sidewall bulge",
          dotSerialCode: null,
          inspectionNotes: null,
          externalClaimReference: null,
          submittedAt: null,
          decisionAt: null,
          decisionNotes: null,
          resolutionType: null,
          resolutionNotes: null,
          resolvedAt: null,
          replacementProductId: null,
          replacementQuantity: 0,
          createdById: "admin-1",
          createdAt: new Date("2026-09-01T10:00:00Z"),
          updatedAt: new Date("2026-09-01T10:00:00Z"),
          sale: { invoiceNumber: "SALE-1001", saleDate: new Date() },
          product: mockProduct,
          customer: mockSale.customer,
        } as unknown as Awaited<ReturnType<typeof db.warrantyClaim.findMany>>[0],
      ]);
      vi.mocked(db.warrantyClaim.count).mockResolvedValue(1);
      vi.mocked(db.warrantyClaim.groupBy).mockResolvedValue([
        {
          status: "SUBMITTED",
          _count: { id: 1 },
        },
      ] as unknown as Awaited<ReturnType<typeof db.warrantyClaim.groupBy>>);

      const result = await listWarrantyClaims({ page: 1, limit: 25 }, mockAdmin);

      expect(result.claims).toHaveLength(1);
      expect(result.claims[0].claimNumber).toBe("WAR-1001");
      expect(result.metrics.totalClaims).toBe(1);
      expect(result.metrics.submittedClaims).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });
  });

  describe("getWarrantyClaimById", () => {
    it("returns detailed claim view for valid claim ID", async () => {
      vi.mocked(db.warrantyClaim.findUnique).mockResolvedValue({
        id: "claim-1",
        claimNumber: "WAR-1001",
        saleId: "sale-1",
        saleItemId: "item-1",
        productId: "prod-1",
        customerId: "cust-1",
        supplierId: null,
        claimType: "WARRANTY_DEFECT",
        status: "SUBMITTED",
        quantity: 1,
        issueDescription: "Sidewall bulge",
        dotSerialCode: "DOT 4B08",
        inspectionNotes: "Visible defect",
        externalClaimReference: null,
        submittedAt: null,
        decisionAt: null,
        decisionNotes: null,
        resolutionType: null,
        resolutionNotes: null,
        resolvedAt: null,
        replacementProductId: null,
        replacementQuantity: 0,
        createdById: "admin-1",
        createdAt: new Date("2026-09-01T10:00:00Z"),
        updatedAt: new Date("2026-09-01T10:00:00Z"),
        sale: { invoiceNumber: "SALE-1001", saleDate: new Date(), createdById: "admin-1" },
        saleItem: mockSaleItem,
        product: mockProduct,
        customer: mockSale.customer,
        supplier: null,
        createdBy: { fullName: "Admin Owner", username: "admin" },
      } as unknown as Awaited<ReturnType<typeof db.warrantyClaim.findUnique>>);

      const result = await getWarrantyClaimById("claim-1", mockAdmin);

      expect(result.id).toBe("claim-1");
      expect(result.claimNumber).toBe("WAR-1001");
      expect(result.customerName).toBe("Sunil Sharma");
    });
  });

  describe("updateWarrantyClaimStatus", () => {
    const existingClaim = {
      id: "claim-1",
      claimNumber: "WAR-1001",
      status: "SUBMITTED" as const,
      createdAt: new Date("2026-09-01T10:00:00Z"),
      updatedAt: new Date("2026-09-01T10:00:00Z"),
      sale: mockSale,
      product: mockProduct,
    };

    it("transitions SUBMITTED -> UNDER_REVIEW with submission metadata", async () => {
      vi.mocked(db.warrantyClaim.findUnique).mockResolvedValue(existingClaim as unknown as Awaited<ReturnType<typeof db.warrantyClaim.findUnique>>);
      mockTx.warrantyClaim.update.mockResolvedValue({
        ...existingClaim,
        status: "UNDER_REVIEW",
        submittedAt: new Date(),
        externalClaimReference: "BRAND-REF-999",
        sale: mockSale,
        saleItem: mockSaleItem,
        product: mockProduct,
        customer: mockSale.customer,
        supplier: null,
        createdBy: null,
      });

      const result = await updateWarrantyClaimStatus(
        "claim-1",
        {
          status: "UNDER_REVIEW",
          externalClaimReference: "BRAND-REF-999",
        },
        mockManager
      );

      expect(result.status).toBe("UNDER_REVIEW");
      expect(mockTx.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "WARRANTY_CLAIM_SUBMITTED",
          entityId: "claim-1",
        }),
      });
    });

    it("transitions UNDER_REVIEW -> APPROVED with decision notes", async () => {
      const underReviewClaim = {
        ...existingClaim,
        status: "UNDER_REVIEW" as const,
      };
      vi.mocked(db.warrantyClaim.findUnique).mockResolvedValue(underReviewClaim as unknown as Awaited<ReturnType<typeof db.warrantyClaim.findUnique>>);
      mockTx.warrantyClaim.update.mockResolvedValue({
        ...underReviewClaim,
        status: "APPROVED",
        decisionAt: new Date(),
        decisionNotes: "Apollo inspection team approved manufacturing defect",
        sale: mockSale,
        saleItem: mockSaleItem,
        product: mockProduct,
        customer: mockSale.customer,
        supplier: null,
        createdBy: null,
      });

      const result = await updateWarrantyClaimStatus(
        "claim-1",
        {
          status: "APPROVED",
          decisionNotes: "Apollo inspection team approved manufacturing defect",
        },
        mockManager
      );

      expect(result.status).toBe("APPROVED");
      expect(mockTx.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "WARRANTY_CLAIM_APPROVED",
          entityId: "claim-1",
        }),
      });
    });

    it("rejects invalid status transitions (e.g. SUBMITTED directly to APPROVED)", async () => {
      vi.mocked(db.warrantyClaim.findUnique).mockResolvedValue(existingClaim as unknown as Awaited<ReturnType<typeof db.warrantyClaim.findUnique>>);

      await expect(
        updateWarrantyClaimStatus(
          "claim-1",
          {
            status: "APPROVED",
          },
          mockManager
        )
      ).rejects.toThrow("Invalid status transition from SUBMITTED to APPROVED");
    });
  });

  describe("issueWarrantyReplacement", () => {
    it("atomically deducts inventory stock and creates WARRANTY_OUT_REPLACEMENT movement", async () => {
      const approvedClaim = {
        id: "claim-1",
        claimNumber: "WAR-1001",
        status: "APPROVED",
        productId: "prod-1",
        quantity: 1,
        replacementQuantity: 0,
        resolutionType: null,
        createdAt: new Date("2026-09-01T10:00:00Z"),
        updatedAt: new Date("2026-09-01T10:00:00Z"),
        sale: mockSale,
        saleItem: mockSaleItem,
        product: mockProduct,
      };

      mockTx.warrantyClaim.findUnique.mockResolvedValue(approvedClaim);
      mockTx.product.findUnique.mockResolvedValue(mockProduct);
      mockTx.product.update.mockResolvedValue({
        ...mockProduct,
        quantityOnHand: 4, // 5 - 1
      });
      mockTx.warrantyClaim.update.mockResolvedValue({
        ...approvedClaim,
        status: "RESOLVED",
        resolutionType: "REPLACEMENT_FROM_STOCK",
        resolutionNotes: "New tyre handed over to customer",
        resolvedAt: new Date(),
        replacementProductId: "prod-1",
        replacementQuantity: 1,
        sale: mockSale,
        saleItem: mockSaleItem,
        product: mockProduct,
        replacementProduct: mockProduct,
        customer: mockSale.customer,
        supplier: null,
        createdBy: null,
      });

      const result = await issueWarrantyReplacement(
        "claim-1",
        {
          notes: "New tyre handed over to customer",
        },
        mockManager
      );

      expect(result.status).toBe("RESOLVED");
      expect(result.resolutionType).toBe("REPLACEMENT_FROM_STOCK");
      expect(result.replacementQuantity).toBe(1);

      // Verify physical stock was decremented
      expect(mockTx.product.update).toHaveBeenCalledWith({
        where: { id: "prod-1" },
        data: { quantityOnHand: { decrement: 1 } },
      });

      // Verify WARRANTY_OUT_REPLACEMENT inventory movement
      expect(mockTx.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: "prod-1",
          movementType: "WARRANTY_OUT_REPLACEMENT",
          quantityDelta: -1,
          balanceAfter: 4,
          referenceType: "WarrantyClaim",
          referenceId: "claim-1",
          actorId: "mgr-1",
        }),
      });

      // Verify audit log
      expect(mockTx.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "WARRANTY_REPLACEMENT_ISSUED",
          entityId: "claim-1",
        }),
      });
    });

    it("rejects replacement when physical warehouse inventory is insufficient", async () => {
      const approvedClaim = {
        id: "claim-1",
        status: "APPROVED",
        productId: "prod-1",
        quantity: 1,
        replacementQuantity: 0,
        resolutionType: null,
      };

      mockTx.warrantyClaim.findUnique.mockResolvedValue(approvedClaim);
      mockTx.product.findUnique.mockResolvedValue({
        ...mockProduct,
        quantityOnHand: 0, // Out of stock
      });

      await expect(
        issueWarrantyReplacement("claim-1", {}, mockManager)
      ).rejects.toThrow("Insufficient inventory for replacement. Available: 0, Requested: 1");
    });

    it("rejects replacement if claim is not APPROVED", async () => {
      mockTx.warrantyClaim.findUnique.mockResolvedValue({
        id: "claim-1",
        status: "SUBMITTED",
        replacementQuantity: 0,
      });

      await expect(
        issueWarrantyReplacement("claim-1", {}, mockManager)
      ).rejects.toThrow("Replacement can only be issued for APPROVED claims");
    });
  });

  describe("resolveWarrantyClaim", () => {
    it("resolves claim via credit note without stock movements", async () => {
      vi.mocked(db.warrantyClaim.findUnique).mockResolvedValue({
        id: "claim-1",
        status: "APPROVED",
      } as unknown as Awaited<ReturnType<typeof db.warrantyClaim.findUnique>>);

      mockTx.warrantyClaim.update.mockResolvedValue({
        id: "claim-1",
        claimNumber: "WAR-1001",
        status: "RESOLVED",
        resolutionType: "CREDIT_NOTE",
        resolutionNotes: "Brand granted credit note to customer",
        resolvedAt: new Date(),
        createdAt: new Date("2026-09-01T10:00:00Z"),
        updatedAt: new Date("2026-09-01T10:00:00Z"),
        sale: mockSale,
        saleItem: mockSaleItem,
        product: mockProduct,
        replacementProduct: null,
        customer: mockSale.customer,
        supplier: null,
        createdBy: null,
      });

      const result = await resolveWarrantyClaim(
        "claim-1",
        {
          resolutionType: "CREDIT_NOTE",
          resolutionNotes: "Brand granted credit note to customer",
        },
        mockManager
      );

      expect(result.status).toBe("RESOLVED");
      expect(result.resolutionType).toBe("CREDIT_NOTE");
      expect(mockTx.product.update).not.toHaveBeenCalled();
      expect(mockTx.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });
});
