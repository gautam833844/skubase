import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SuppliersPage from "@/app/suppliers/page";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("SuppliersPage UI Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page title and suppliers table", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: "s1",
            name: "Metro Tyre Distributors",
            contactPerson: "Ramesh",
            phoneNumber: "9876543210",
            whatsappNumber: "9876543210",
            gstNumber: "27AABCU9603R1ZM",
            address: "Industrial Area",
            isActive: true,
            _count: { purchaseOrders: 3, purchaseReceipts: 2 },
          },
        ],
        metrics: { totalActiveSuppliers: 1, totalSuppliers: 1 },
      }),
    });

    render(<SuppliersPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Suppliers Directory" })).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("Metro Tyre Distributors")).toBeDefined();
      expect(screen.getByText("Ramesh")).toBeDefined();
      expect(screen.getByText("9876543210")).toBeDefined();
    });
  });

  it("opens and closes Add Supplier modal", async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [],
        metrics: { totalActiveSuppliers: 0, totalSuppliers: 0 },
      }),
    });

    render(<SuppliersPage />);

    const addButton = screen.getByRole("button", { name: "+ Add New Supplier" });
    await user.click(addButton);

    expect(screen.getByRole("heading", { level: 2, name: "Add New Supplier" })).toBeDefined();

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole("heading", { level: 2, name: "Add New Supplier" })).toBeNull();
    });
  });
});
