import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import SalesPage from "@/app/sales/page";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("SalesPage UI Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sales list and status KPI cards", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: "sale-1",
            invoiceNumber: "SALE-1001",
            saleDate: new Date().toISOString(),
            status: "DRAFT",
            subtotal: "20000.00",
            discountAmount: "0.00",
            totalAmount: "20000.00",
            customer: {
              id: "c1",
              name: "Sunil Sharma",
              phoneNumber: "9820123456",
              vehicleNumber: "MH02AB1234",
            },
            createdBy: { id: "u1", fullName: "Admin Owner", username: "owner" },
            itemCount: 1,
            totalQuantity: 4,
          },
        ],
        statusCounts: { DRAFT: 1 },
      }),
    });

    render(<SalesPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Sales & Billing" })).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("SALE-1001")).toBeDefined();
      expect(screen.getByText("Sunil Sharma")).toBeDefined();
      expect(screen.getByText("MH02AB1234")).toBeDefined();
    });
  });
});
