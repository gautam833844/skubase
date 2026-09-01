import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InventoryPage from "@/app/inventory/page";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("InventoryPage UI Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page title, summary cards, and search input", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: "p1",
            brand: "MRF",
            size: "195/65 R15",
            pattern: "ZVTV",
            unitPrice: 4500,
            quantityOnHand: 12,
            minStockAlert: 4,
            isActive: true,
          },
        ],
        metrics: {
          totalPhysicalTyres: 12,
          totalActiveProducts: 1,
        },
      }),
    });

    render(<InventoryPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Tyre Inventory" })).toBeDefined();
    expect(screen.getByPlaceholderText(/search by brand, size/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getAllByText("MRF").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("195/65 R15")).toBeDefined();
      expect(screen.getByText(/12\s+in stock/i)).toBeDefined();
    });
  });

  it("opens and closes Add Product modal", async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [],
        metrics: { totalPhysicalTyres: 0, totalActiveProducts: 0 },
      }),
    });

    render(<InventoryPage />);

    const addButton = screen.getByRole("button", { name: "+ Add New Tyre" });
    await user.click(addButton);

    expect(screen.getByRole("heading", { level: 2, name: "Add New Tyre Product" })).toBeDefined();
    expect(screen.getByPlaceholderText(/e.g. MRF, Apollo/i)).toBeDefined();

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole("heading", { level: 2, name: "Add New Tyre Product" })).toBeNull();
    });
  });

  it("opens stock adjustment modal on clicking Adjust Stock", async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: "p1",
            brand: "Apollo",
            size: "205/55 R16",
            pattern: "Alnac 4G",
            unitPrice: 5200,
            quantityOnHand: 6,
            minStockAlert: 4,
            isActive: true,
          },
        ],
        metrics: { totalPhysicalTyres: 6, totalActiveProducts: 1 },
      }),
    });

    render(<InventoryPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Apollo").length).toBeGreaterThanOrEqual(1);
    });

    const adjustBtn = screen.getByRole("button", { name: "Adjust Stock" });
    await user.click(adjustBtn);

    expect(screen.getByRole("heading", { level: 2, name: "Manual Stock Adjustment" })).toBeDefined();
    expect(screen.getByText(/Apollo 205\/55 R16 Alnac 4G/i)).toBeDefined();
    expect(screen.getByText("6 tyres")).toBeDefined();
  });
});
