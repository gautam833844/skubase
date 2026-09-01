import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CustomersPage from "@/app/customers/page";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("CustomersPage UI Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page title and customers table", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: "c1",
            name: "Sunil Sharma",
            phoneNumber: "9820123456",
            vehicleNumber: "MH02AB1234",
            vehicleModel: "Hyundai Creta",
            address: "Mumbai",
            isActive: true,
            _count: { sales: 2 },
          },
        ],
        metrics: { totalActiveCustomers: 1, totalCustomers: 1 },
      }),
    });

    render(<CustomersPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Customer Records" })).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("Sunil Sharma")).toBeDefined();
      expect(screen.getByText("9820123456")).toBeDefined();
      expect(screen.getByText("MH02AB1234")).toBeDefined();
    });
  });

  it("opens and closes Add Customer modal", async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [],
        metrics: { totalActiveCustomers: 0, totalCustomers: 0 },
      }),
    });

    render(<CustomersPage />);

    const addButton = screen.getByRole("button", { name: "+ Add New Customer" });
    await user.click(addButton);

    expect(screen.getByRole("heading", { level: 2, name: "Add New Customer" })).toBeDefined();

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole("heading", { level: 2, name: "Add New Customer" })).toBeNull();
    });
  });
});
