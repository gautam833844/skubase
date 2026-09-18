import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NewAlignmentBillPage from "@/app/alignment/new/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/alignment/new",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("NewAlignmentBillPage UI Component UX Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with 11 standard services defaulting quantity to empty (0) and total amount to 0", () => {
    render(<NewAlignmentBillPage />);

    expect(screen.getByRole("heading", { level: 1, name: /New Alignment Bill/i })).toBeDefined();

    // Verify all 11 rows have visually empty quantity with placeholder "0"
    const qtyInputs = screen.getAllByPlaceholderText("0");
    expect(qtyInputs.length).toBeGreaterThanOrEqual(11);
    qtyInputs.forEach((input) => {
      expect((input as HTMLInputElement).value).toBe("");
    });

    // Total Amount should be ₹0.00
    expect(screen.getByText("₹0.00")).toBeDefined();

    // Payment details section renders for Bill
    expect(screen.getByText(/Payment Details/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /^Cash$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^UPI$/i })).toBeDefined();
  });

  it("defaults newly added additional service rows to empty quantity (0)", async () => {
    const user = userEvent.setup();
    render(<NewAlignmentBillPage />);

    const addBtn = screen.getByRole("button", { name: /Add Service/i });
    await user.click(addBtn);

    // Should have 12 rows now
    const customParticular = screen.getByPlaceholderText(/Enter service name/i);
    expect(customParticular).toBeDefined();

    const qtyInputs = screen.getAllByPlaceholderText("0");
    expect(qtyInputs).toHaveLength(12);
    expect((qtyInputs[11] as HTMLInputElement).value).toBe("");
  });

  it("toggles payment mode between Cash and UPI", async () => {
    const user = userEvent.setup();
    render(<NewAlignmentBillPage />);

    const cashBtn = screen.getByRole("button", { name: /^Cash$/i });
    const upiBtn = screen.getByRole("button", { name: /^UPI$/i });

    expect(cashBtn.className).toContain("bg-primary-600");

    await user.click(upiBtn);
    expect(upiBtn.className).toContain("bg-primary-600");
  });

  it("displays estimate notice when switched to ESTIMATE document type", async () => {
    const user = userEvent.setup();
    render(<NewAlignmentBillPage />);

    const estimateTab = screen.getByRole("button", { name: /ESTIMATE/i });
    await user.click(estimateTab);

    expect(screen.getByText(/Estimate \/ Quote Mode:/i)).toBeDefined();
  });

  it("sanitizes numeric fields (Phone, KM, Qty) to digits only", async () => {
    const user = userEvent.setup();
    render(<NewAlignmentBillPage />);

    // Phone Number input
    const phoneInput = screen.getByPlaceholderText(/9876543210/i) as HTMLInputElement;
    await user.type(phoneInput, "abc987-xyz-654! 3210");
    expect(phoneInput.value).toBe("9876543210");

    // KM input
    const kmInput = screen.getByPlaceholderText(/45000/i) as HTMLInputElement;
    await user.type(kmInput, "12a3b4c5");
    expect(kmInput.value).toBe("12345");

    // Qty input for first row
    const firstQtyInput = screen.getAllByPlaceholderText("0")[0] as HTMLInputElement;
    await user.clear(firstQtyInput);
    await user.type(firstQtyInput, "4x5y");
    expect(firstQtyInput.value).toBe("45");
  });

  it("sanitizes Rates field to decimal numbers only", async () => {
    const user = userEvent.setup();
    render(<NewAlignmentBillPage />);

    const firstRateInput = screen.getAllByPlaceholderText("0.00")[0] as HTMLInputElement;
    await user.type(firstRateInput, "abc450.50.99xyz");
    expect(firstRateInput.value).toBe("450.5099");
  });

  it("moves focus to the next input when Enter key is pressed without submitting form", () => {
    render(<NewAlignmentBillPage />);

    const customerInput = screen.getByPlaceholderText(/Rajesh Kumar/i) as HTMLInputElement;
    const vehInput = screen.getByPlaceholderText(/TN 01 AB 1234/i) as HTMLInputElement;

    customerInput.focus();
    expect(document.activeElement).toBe(customerInput);

    // Press Enter on customer input
    fireEvent.keyDown(customerInput, { key: "Enter", code: "Enter" });

    // Focus should move to Veh No input
    expect(document.activeElement).toBe(vehInput);

    // Ensure mockFetch was not called (form did not submit)
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
