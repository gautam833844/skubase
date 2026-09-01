import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WarrantyPage from "@/app/warranty/page";
import WarrantyClaimDetailPage from "@/app/warranty/[id]/page";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Warranty UI Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("WarrantyPage (/warranty)", () => {
    it("renders warranty dashboard with KPI metrics, filters, and claims list", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "claim-1",
              claimNumber: "WAR-1001",
              saleInvoiceNumber: "SALE-1001",
              saleDate: "2026-09-01T10:00:00.000Z",
              customerName: "Ramesh Sharma",
              productBrand: "Apollo",
              productSize: "205/55 R16",
              status: "SUBMITTED",
              issueDescription: "Sidewall bulge after 500 km",
              resolutionType: null,
              replacementQuantity: 0,
              createdAt: "2026-09-01T10:00:00.000Z",
            },
          ],
          metrics: {
            totalClaims: 1,
            submittedClaims: 1,
            underReviewClaims: 0,
            approvedClaims: 0,
            resolvedClaims: 0,
            rejectedClaims: 0,
          },
          pagination: { page: 1, limit: 25, totalCount: 1, totalPages: 1 },
        }),
      });

      render(<WarrantyPage />);

      await waitFor(() => {
        expect(screen.getByText("Warranty Claims Management")).toBeDefined();
        expect(screen.getByText("WAR-1001")).toBeDefined();
        expect(screen.getByText("Apollo 205/55 R16")).toBeDefined();
        expect(screen.getByText("Ramesh Sharma")).toBeDefined();
      });
    });
  });

  describe("WarrantyClaimDetailPage (/warranty/[id])", () => {
    it("renders claim details, pipeline timeline, and opens Brand Review modal", async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
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
            customerName: "Ramesh Sharma",
            customerPhone: "9876543210",
            customerVehicle: "MH02CD1234",
            supplierId: null,
            supplierName: null,
            claimType: "WARRANTY_DEFECT",
            status: "SUBMITTED",
            quantity: 1,
            issueDescription: "Sidewall bulge after 500 km",
            dotSerialCode: "DOT 4B08",
            inspectionNotes: "Visible bulge detected",
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
          },
        }),
      });

      render(<WarrantyClaimDetailPage params={{ id: "claim-1" }} />);

      await waitFor(() => {
        expect(screen.getByText("WAR-1001")).toBeDefined();
        expect(screen.getByText("Ramesh Sharma")).toBeDefined();
        expect(screen.getByText("Sidewall bulge after 500 km")).toBeDefined();
      });

      // Click "Submit for Brand Review" button
      const reviewButton = screen.getByRole("button", { name: "📝 Submit for Brand Review" });
      await user.click(reviewButton);

      expect(screen.getByRole("heading", { level: 2, name: "Submit Claim for Brand Review" })).toBeDefined();

      // Close modal
      const cancelBtn = screen.getByRole("button", { name: "Cancel" });
      await user.click(cancelBtn);

      await waitFor(() => {
        expect(screen.queryByRole("heading", { level: 2, name: "Submit Claim for Brand Review" })).toBeNull();
      });
    });
  });
});
