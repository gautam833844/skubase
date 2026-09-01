import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PurchasesPage from "@/app/purchases/page";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("PurchasesPage UI Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders purchase orders list and status cards", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: "po1",
            poNumber: "PO-1001",
            orderDate: new Date().toISOString(),
            status: "ORDERED",
            supplier: { id: "s1", name: "Metro Tyre Distributors", phoneNumber: "9876543210" },
            summary: { totalOrdered: 4, totalReceived: 0, remaining: 4 },
            items: [],
          },
        ],
        statusCounts: { ORDERED: 1 },
      }),
    });

    render(<PurchasesPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Purchase Orders" })).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("PO-1001")).toBeDefined();
      expect(screen.getByText("Metro Tyre Distributors")).toBeDefined();
    });
  });

  it("opens Create Purchase Order modal on button click", async () => {
    const user = userEvent.setup();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          statusCounts: {},
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{ id: "s1", name: "Metro Tyre Distributors" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{ id: "p1", brand: "MRF", size: "195/65 R15", pattern: "ZVTV" }],
        }),
      });

    render(<PurchasesPage />);

    const createBtn = screen.getByRole("button", { name: "+ Create Purchase Order" });
    await user.click(createBtn);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: "Create Purchase Order" })).toBeDefined();
      expect(screen.getByText(/Select Supplier/i)).toBeDefined();
    });
  });
});
