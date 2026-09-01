import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SaleDetailPage from "@/app/sales/[id]/page";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("SaleDetailPage UI Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders draft sale and opens confirmation modal", async () => {
    const user = userEvent.setup();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "sale-1",
            invoiceNumber: "SALE-1001",
            saleDate: new Date().toISOString(),
            status: "DRAFT",
            paymentStatus: "UNPAID",
            subtotal: "26000.00",
            discountAmount: "0.00",
            taxAmount: "0.00",
            totalAmount: "26000.00",
            notes: null,
            customer: {
              id: "cust-1",
              name: "Vikram Malhotra",
              phoneNumber: "9876543210",
              vehicleNumber: "MH01AB9999",
              vehicleModel: "Honda City",
              address: "Mumbai",
            },
            createdBy: { id: "u1", fullName: "Admin Owner", username: "owner" },
            items: [
              {
                id: "item-1",
                productId: "prod-1",
                quantity: 4,
                unitPrice: "6500.00",
                costPrice: "5200.00",
                discountAmount: "0.00",
                totalPrice: "26000.00",
                product: {
                  id: "prod-1",
                  brand: "Apollo",
                  size: "205/55 R16",
                  pattern: "Alnac 4G",
                  unitPrice: "6500.00",
                  quantityOnHand: 10,
                },
              },
            ],
            itemCount: 1,
            totalQuantity: 4,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            saleId: "sale-1",
            invoiceNumber: "SALE-1001",
            saleStatus: "DRAFT",
            totalAmount: "26000.00",
            totalPaid: "0.00",
            remainingBalance: "26000.00",
            paymentStatus: "UNPAID",
            payments: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            returns: [],
            returnableItems: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            saleId: "sale-1",
            invoiceNumber: "SALE-1001",
            saleDate: new Date().toISOString(),
            customerName: "Vikram Malhotra",
            items: [],
            claims: [],
          },
        }),
      });

    render(<SaleDetailPage params={{ id: "sale-1" }} />);

    await waitFor(() => {
      expect(screen.getByText("SALE-1001")).toBeDefined();
      expect(screen.getByText("Vikram Malhotra")).toBeDefined();
      expect(screen.getByText("Apollo 205/55 R16")).toBeDefined();
    });

    // Open confirmation modal
    const confirmButton = screen.getByRole("button", { name: "Confirm Sale (Deduct Stock)" });
    await user.click(confirmButton);

    expect(screen.getByRole("heading", { level: 2, name: "Confirm & Finalize Sale" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Confirm & Deduct Stock" })).toBeDefined();

    // Close modal via Cancel
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole("heading", { level: 2, name: "Confirm & Finalize Sale" })).toBeNull();
    });
  });

  it("renders completed sale with payment summary KPIs and opens Record Payment modal", async () => {
    const user = userEvent.setup();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "sale-completed",
            invoiceNumber: "SALE-1002",
            saleDate: new Date().toISOString(),
            status: "COMPLETED",
            paymentStatus: "PARTIALLY_PAID",
            subtotal: "20000.00",
            discountAmount: "0.00",
            taxAmount: "0.00",
            totalAmount: "20000.00",
            notes: null,
            customer: {
              id: "cust-1",
              name: "Anand Sharma",
              phoneNumber: "9876543210",
              vehicleNumber: "DL01AA1111",
              vehicleModel: "Creta",
              address: "Delhi",
            },
            createdBy: { id: "u1", fullName: "Admin Owner", username: "owner" },
            items: [],
            itemCount: 0,
            totalQuantity: 0,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            saleId: "sale-completed",
            invoiceNumber: "SALE-1002",
            saleStatus: "COMPLETED",
            totalAmount: "20000.00",
            totalPaid: "12000.00",
            remainingBalance: "8000.00",
            paymentStatus: "PARTIALLY_PAID",
            payments: [
              {
                id: "p1",
                amount: "12000.00",
                paymentMethod: "CASH",
                referenceNumber: null,
                paymentDate: new Date().toISOString(),
                notes: "Advance cash",
                createdBy: { id: "u1", fullName: "Admin Owner", username: "owner" },
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            returns: [],
            returnableItems: [
              {
                saleItemId: "item-1",
                productId: "prod-1",
                brand: "Apollo",
                size: "205/55 R16",
                pattern: "Alnac 4G",
                soldQuantity: 4,
                alreadyReturnedQuantity: 0,
                returnableQuantity: 4,
                unitPrice: "5000.00",
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            saleId: "sale-completed",
            invoiceNumber: "SALE-1002",
            saleDate: new Date().toISOString(),
            customerName: "Anand Sharma",
            items: [],
            claims: [],
          },
        }),
      });

    render(<SaleDetailPage params={{ id: "sale-completed" }} />);

    await waitFor(() => {
      expect(screen.getByText("SALE-1002")).toBeDefined();
      expect(screen.getByText("Total Sale Amount")).toBeDefined();
      expect(screen.getByText("Amount Paid")).toBeDefined();
      expect(screen.getByText("Remaining Balance")).toBeDefined();
    });

    // Verify Record Payment button exists for partially paid sale
    const recordPaymentBtn = screen.getByRole("button", { name: "+ Record Payment" });
    await user.click(recordPaymentBtn);

    expect(screen.getByRole("heading", { level: 2, name: "Record Customer Payment" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Confirm & Save Payment" })).toBeDefined();

    // Close modal via Cancel
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole("heading", { level: 2, name: "Record Customer Payment" })).toBeNull();
    });
  });

  it("renders returns history and opens Process Return modal for eligible completed sale", async () => {
    const user = userEvent.setup();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "sale-completed",
            invoiceNumber: "SALE-1003",
            saleDate: new Date().toISOString(),
            status: "COMPLETED",
            paymentStatus: "PAID",
            subtotal: "20000.00",
            discountAmount: "0.00",
            taxAmount: "0.00",
            totalAmount: "20000.00",
            notes: null,
            customer: {
              id: "cust-1",
              name: "Anand Sharma",
              phoneNumber: "9876543210",
              vehicleNumber: "DL01AA1111",
              vehicleModel: "Creta",
              address: "Delhi",
            },
            createdBy: { id: "u1", fullName: "Admin Owner", username: "owner" },
            items: [
              {
                id: "item-1",
                productId: "prod-1",
                quantity: 4,
                unitPrice: "5000.00",
                costPrice: "4000.00",
                discountAmount: "0.00",
                totalPrice: "20000.00",
                product: {
                  id: "prod-1",
                  brand: "MRF",
                  size: "195/65 R15",
                  pattern: "ZLX",
                  unitPrice: "5000.00",
                  quantityOnHand: 6,
                },
              },
            ],
            itemCount: 1,
            totalQuantity: 4,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            saleId: "sale-completed",
            invoiceNumber: "SALE-1003",
            saleStatus: "COMPLETED",
            totalAmount: "20000.00",
            totalPaid: "20000.00",
            remainingBalance: "0.00",
            paymentStatus: "PAID",
            payments: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            returns: [
              {
                id: "ret-1",
                returnNumber: "RET-1001",
                saleId: "sale-completed",
                saleInvoiceNumber: "SALE-1003",
                customerId: "cust-1",
                customerName: "Anand Sharma",
                returnDate: new Date().toISOString(),
                totalAmount: "5000.00",
                refundAmount: "5000.00",
                status: "COMPLETED",
                refundStatus: "REFUNDED",
                reason: "Wrong tyre size",
                notes: null,
                createdBy: { fullName: "Admin Owner", username: "owner" },
                items: [
                  {
                    id: "ret-i-1",
                    saleItemId: "item-1",
                    productId: "prod-1",
                    brand: "MRF",
                    size: "195/65 R15",
                    pattern: "ZLX",
                    quantity: 1,
                    unitPrice: "5000.00",
                    totalPrice: "5000.00",
                    condition: "SELLABLE",
                    reason: null,
                  },
                ],
                createdAt: new Date().toISOString(),
              },
            ],
            returnableItems: [
              {
                saleItemId: "item-1",
                productId: "prod-1",
                brand: "MRF",
                size: "195/65 R15",
                pattern: "ZLX",
                soldQuantity: 4,
                alreadyReturnedQuantity: 1,
                returnableQuantity: 3,
                unitPrice: "5000.00",
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            saleId: "sale-completed",
            invoiceNumber: "SALE-1003",
            saleDate: new Date().toISOString(),
            customerName: "Anand Sharma",
            items: [],
            claims: [],
          },
        }),
      });

    render(<SaleDetailPage params={{ id: "sale-completed" }} />);

    await waitFor(() => {
      expect(screen.getByText("SALE-1003")).toBeDefined();
      expect(screen.getByText("Total Returns")).toBeDefined();
      expect(screen.getByText("RET-1001")).toBeDefined();
      expect(screen.getByText("Wrong tyre size")).toBeDefined();
    });

    // Open Return modal
    const returnBtn = screen.getByRole("button", { name: /Process Return/i });
    await user.click(returnBtn);

    expect(screen.getByRole("heading", { level: 2, name: "Process Sales Return" })).toBeDefined();
    expect(screen.getByText(/3 returnable/i)).toBeDefined();

    // Close modal via Cancel
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole("heading", { level: 2, name: "Process Sales Return" })).toBeNull();
    });
  });
});
