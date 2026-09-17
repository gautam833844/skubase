import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AlignmentBillingPage from "@/app/alignment/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/alignment",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockBills = [
  {
    id: "aln-1",
    billNumber: "ALN-1001",
    documentType: "BILL",
    date: "2026-09-15T10:00:00.000Z",
    customerId: null,
    customerName: "Rajesh Kumar",
    phoneNumber: "9876543210",
    vehicleNumber: "TN01AB1234",
    kilometers: 45000,
    totalAmount: "770.00",
    status: "COMPLETED",
    notes: null,
    createdById: "admin-1",
    createdAt: "2026-09-15T10:00:00.000Z",
    updatedAt: "2026-09-15T10:00:00.000Z",
    items: [],
  },
  {
    id: "aln-2",
    billNumber: "ALN-1002",
    documentType: "BILL",
    date: "2026-09-16T11:00:00.000Z",
    customerId: null,
    customerName: "Suresh Babu",
    phoneNumber: null,
    vehicleNumber: "KA02CD5678",
    kilometers: 22000,
    totalAmount: "850.00",
    status: "COMPLETED",
    notes: null,
    createdById: "admin-1",
    createdAt: "2026-09-16T11:00:00.000Z",
    updatedAt: "2026-09-16T11:00:00.000Z",
    items: [],
  },
];

describe("AlignmentBillingPage History & Permanent Delete Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, message: "Successfully deleted 1 document(s)." }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: mockBills }),
      });
    });
  });

  it("renders history table with checkboxes", async () => {
    render(<AlignmentBillingPage />);

    await waitFor(() => {
      expect(screen.getByText("ALN-1001")).toBeDefined();
      expect(screen.getByText("ALN-1002")).toBeDefined();
    });

    // Checkbox in header
    expect(screen.getByLabelText(/Select all documents/i)).toBeDefined();

    // Checkboxes per row
    expect(screen.getByLabelText(/Select bill ALN-1001/i)).toBeDefined();
    expect(screen.getByLabelText(/Select bill ALN-1002/i)).toBeDefined();
  });

  it("toggles single row selection and shows Delete Selected action", async () => {
    const user = userEvent.setup();
    render(<AlignmentBillingPage />);

    await waitFor(() => {
      expect(screen.getByText("ALN-1001")).toBeDefined();
    });

    // Initially no "Delete Selected" button
    expect(screen.queryByRole("button", { name: /Delete Selected/i })).toBeNull();

    // Select first bill
    const row1Checkbox = screen.getByLabelText(/Select bill ALN-1001/i);
    await user.click(row1Checkbox);

    // Should display "1 selected" and "Delete Selected" button
    expect(screen.getByText(/1 selected/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Delete Selected/i })).toBeDefined();

    // Uncheck first bill
    await user.click(row1Checkbox);
    expect(screen.queryByRole("button", { name: /Delete Selected/i })).toBeNull();
  });

  it("selects all rows when header checkbox is clicked", async () => {
    const user = userEvent.setup();
    render(<AlignmentBillingPage />);

    await waitFor(() => {
      expect(screen.getByText("ALN-1001")).toBeDefined();
    });

    const headerCheckbox = screen.getByLabelText(/Select all documents/i) as HTMLInputElement;
    await user.click(headerCheckbox);

    expect(screen.getByText(/2 selected/i)).toBeDefined();
    expect((screen.getByLabelText(/Select bill ALN-1001/i) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/Select bill ALN-1002/i) as HTMLInputElement).checked).toBe(true);

    // Uncheck header checkbox
    await user.click(headerCheckbox);
    expect(screen.queryByText(/selected/i)).toBeNull();
  });

  it("opens confirmation modal on Delete Selected and cancels safely", async () => {
    const user = userEvent.setup();
    render(<AlignmentBillingPage />);

    await waitFor(() => {
      expect(screen.getByText("ALN-1001")).toBeDefined();
    });

    const row1Checkbox = screen.getByLabelText(/Select bill ALN-1001/i);
    await user.click(row1Checkbox);

    const deleteBtn = screen.getByRole("button", { name: /Delete Selected/i });
    await user.click(deleteBtn);

    // Modal should be open
    expect(screen.getByText(/Delete selected documents\?/i)).toBeDefined();
    expect(
      screen.getByText(/These Alignment bills\/estimates will be permanently deleted along with their service items/i)
    ).toBeDefined();

    // Click Cancel
    const cancelBtn = screen.getByRole("button", { name: /Cancel/i });
    await user.click(cancelBtn);

    // Modal closes without delete fetch
    expect(screen.queryByText(/Delete selected documents\?/i)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalledWith("/api/alignment", expect.objectContaining({ method: "DELETE" }));
  });

  it("executes permanent deletion on modal confirmation and re-fetches list", async () => {
    const user = userEvent.setup();
    render(<AlignmentBillingPage />);

    await waitFor(() => {
      expect(screen.getByText("ALN-1001")).toBeDefined();
    });

    const row1Checkbox = screen.getByLabelText(/Select bill ALN-1001/i);
    await user.click(row1Checkbox);

    const deleteBtn = screen.getByRole("button", { name: /Delete Selected/i });
    await user.click(deleteBtn);

    // Click confirm Delete in modal
    const modalDeleteBtn = screen.getByRole("button", { name: "Delete" });
    await user.click(modalDeleteBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/alignment", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ["aln-1"] }),
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Successfully deleted 1 document\(s\)\./i)).toBeDefined();
    });
  });
});
