import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportsPage from "@/app/reports/page";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ReportsPage Component Tests", () => {
  const mockStockData = {
    metrics: {
      totalActiveProducts: 2,
      totalPhysicalTyres: 35,
      totalCostValue: 105000,
      totalRetailValue: 147000,
      estimatedGrossMargin: 42000,
      marginPercentage: 28.57,
    },
    items: [
      {
        id: "p1",
        brand: "Apollo",
        size: "195/65 R15",
        pattern: "Alnac 4G",
        quantityOnHand: 30,
        minStockAlert: 4,
        averageCostPrice: 3000,
        unitPrice: 4200,
        totalCostValue: 90000,
        totalRetailValue: 126000,
      },
    ],
  };

  const mockLowStockData = {
    metrics: {
      lowStockCount: 1,
      outOfStockCount: 0,
      totalDeficitUnits: 2,
    },
    items: [
      {
        id: "p2",
        brand: "CEAT",
        size: "196/R19",
        pattern: "Secura",
        quantityOnHand: 2,
        minStockAlert: 4,
        deficit: 2,
        isOutOfStock: false,
        averageCostPrice: 4000,
        unitPrice: 5035,
      },
    ],
  };

  const mockSalesData = {
    dateRange: { startDate: "2026-09-01", endDate: "2026-09-30" },
    metrics: {
      completedSalesCount: 1,
      tyresSold: 4,
      grossSales: 16800,
      discounts: 0,
      netRevenue: 16800,
      cogs: 12000,
      grossProfit: 4800,
      profitMargin: 28.57,
      totalCollected: 16800,
      outstandingBalance: 0,
    },
    paymentBreakdown: [{ method: "UPI", amount: 16800, count: 1 }],
    sales: [
      {
        id: "s1",
        invoiceNumber: "INV-1004",
        saleDate: "2026-09-01T15:00:00Z",
        customerName: "Vikram Malhotra",
        vehicleNumber: "MH01AB9999",
        totalAmount: 16800,
        paymentStatus: "PAID",
        itemCount: 4,
      },
    ],
  };

  const mockMovementsData = {
    dateRange: { startDate: "2026-09-01", endDate: "2026-09-30" },
    metrics: {
      totalMovements: 1,
      totalInflow: 20,
      totalOutflow: 4,
      netChange: 16,
    },
    movements: [
      {
        id: "m1",
        createdAt: "2026-09-01T15:00:00Z",
        movementType: "SALE",
        quantityDelta: -4,
        balanceAfter: 16,
        reason: "Completed Sale",
        referenceType: "SALE",
        referenceId: "s1",
        product: { id: "p1", brand: "Apollo", size: "195/65 R15", pattern: "Alnac 4G" },
        actor: { id: "u1", fullName: "Admin Owner", username: "admin" },
      },
    ],
    pagination: { page: 1, limit: 50, totalCount: 1, totalPages: 1 },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("type=stock")) {
        return { ok: true, json: async () => ({ success: true, data: mockStockData }) };
      }
      if (url.includes("type=low_stock")) {
        return { ok: true, json: async () => ({ success: true, data: mockLowStockData }) };
      }
      if (url.includes("type=sales")) {
        return { ok: true, json: async () => ({ success: true, data: mockSalesData }) };
      }
      if (url.includes("type=movements")) {
        return { ok: true, json: async () => ({ success: true, data: mockMovementsData }) };
      }
      return { ok: true, json: async () => ({ success: true, data: null }) };
    });
  });

  it("renders the page header and all 4 report tabs", async () => {
    render(<ReportsPage />);

    expect(screen.getByText("Business Reports & Analytics")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stock Valuation & Status/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Low Stock Alerts/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sales & Profit Summary/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stock Movement Ledger/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Active Products")).toBeInTheDocument();
      expect(screen.getByText("Total Physical Tyres")).toBeInTheDocument();
    });
  });

  it("loads and displays Low Stock Alerts when tab is clicked", async () => {
    const user = userEvent.setup();

    render(<ReportsPage />);

    const lowStockTab = screen.getByRole("button", { name: /Low Stock Alerts/i });
    await user.click(lowStockTab);

    await waitFor(() => {
      expect(screen.getByText("Total Reorder Deficit")).toBeInTheDocument();
      expect(screen.getByText("CEAT")).toBeInTheDocument();
      expect(screen.getByText("196/R19")).toBeInTheDocument();
    });
  });

  it("loads and displays Sales & Profit Summary with date filter presets", async () => {
    const user = userEvent.setup();

    render(<ReportsPage />);

    const salesTab = screen.getByRole("button", { name: /Sales & Profit Summary/i });
    await user.click(salesTab);

    await waitFor(() => {
      expect(screen.getByText("Net Sales Revenue")).toBeInTheDocument();
      expect(screen.getByText("Gross Profit & Margin")).toBeInTheDocument();
      expect(screen.getByText("Vikram Malhotra")).toBeInTheDocument();
      expect(screen.getByText("INV-1004")).toBeInTheDocument();
    });
  });

  it("loads and displays Stock Movement Ledger with movement types", async () => {
    const user = userEvent.setup();

    render(<ReportsPage />);

    const movementsTab = screen.getByRole("button", { name: /Stock Movement Ledger/i });
    await user.click(movementsTab);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("type=movements"));
    });

    await waitFor(() => {
      expect(screen.getByText("Total Inflow (+)")).toBeInTheDocument();
      expect(screen.getByText("Total Outflow (-)")).toBeInTheDocument();
      expect(screen.getByText("Physical Stock Movement Audit Trail")).toBeInTheDocument();
      expect(screen.getByText("1 movement(s) recorded")).toBeInTheDocument();
    });
  });

  it("renders empty state cleanly when database contains 0 records", async () => {
    mockFetch.mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          metrics: {
            totalActiveProducts: 0,
            totalPhysicalTyres: 0,
            totalCostValue: 0,
            totalRetailValue: 0,
            estimatedGrossMargin: 0,
            marginPercentage: 0,
          },
          items: [],
        },
      }),
    }));

    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByText("No active tyre products found in inventory.")).toBeInTheDocument();
    });
  });
});
