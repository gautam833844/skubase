import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SaleReceiptPage from "@/app/sales/[id]/receipt/page";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("SaleReceiptPage Component", () => {
  const mockReceiptData = {
    saleId: "sale-1",
    invoiceNumber: "SALE-1001",
    saleDate: new Date("2026-09-01T10:00:00Z").toISOString(),
    status: "COMPLETED",
    isDraft: false,
    documentTitle: "SALE RECEIPT",
    shop: {
      name: "Skubase Tyre Hub",
      tagline: "Quality Tyres & Service",
      addressLine1: "Plot No. 42",
      addressLine2: "Main Road",
      city: "Mumbai - 400001",
      phoneNumber: "+91 98765 43210",
      email: "contact@skubasetyres.com",
      footerNotice: "Thank you for your business!",
    },
    customer: {
      name: "Vikram Malhotra",
      phoneNumber: "9876543210",
      vehicleNumber: "MH01AB9999",
      vehicleModel: "Honda City",
      address: "Mumbai",
    },
    seller: {
      fullName: "Staff Member",
      username: "staff1",
    },
    items: [
      {
        id: "item-1",
        brand: "Apollo",
        size: "205/55 R16",
        pattern: "Alnac 4G",
        quantity: 2,
        unitPrice: "6500.00",
        discountAmount: "0.00",
        totalPrice: "13000.00",
      },
    ],
    itemCount: 1,
    totalQuantity: 2,
    subtotal: "13000.00",
    discountAmount: "0.00",
    totalAmount: "13000.00",
    totalPaid: "13000.00",
    remainingBalance: "0.00",
    paymentStatus: "PAID",
    payments: [
      {
        id: "p1",
        amount: "13000.00",
        paymentMethod: "CASH",
        referenceNumber: null,
        paymentDate: new Date().toISOString(),
      },
    ],
    notes: "Customer requested receipt via email",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders receipt preview with shop header, customer block, tyre items, and print/download buttons", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockReceiptData,
      }),
    });

    render(<SaleReceiptPage params={{ id: "sale-1" }} />);

    await waitFor(() => {
      expect(screen.getByText("Skubase Tyre Hub")).toBeDefined();
      expect(screen.getByText("SALE-1001")).toBeDefined();
      expect(screen.getByText("Vikram Malhotra")).toBeDefined();
      expect(screen.getByText("MH01AB9999")).toBeDefined();
      expect(screen.getByText(/Apollo 205\/55 R16/i)).toBeDefined();
      expect(screen.getByText("Payment Record Summary")).toBeDefined();
    });

    // Check action buttons
    expect(screen.getByRole("button", { name: /Print Receipt/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Download PDF/i })).toBeDefined();
  });

  it("triggers window.print on Print button click", async () => {
    const user = userEvent.setup();
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockReceiptData,
      }),
    });

    render(<SaleReceiptPage params={{ id: "sale-1" }} />);

    await waitFor(() => {
      expect(screen.getByText("SALE-1001")).toBeDefined();
    });

    const printBtn = screen.getByRole("button", { name: /Print Receipt/i });
    await user.click(printBtn);

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });
});
