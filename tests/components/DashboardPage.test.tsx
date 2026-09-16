import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardPage from "@/app/page";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("DashboardPage Component Tests (V1.1)", () => {
  const mockKpis = {
    todaySales: 12500,
    todayGrossProfit: 4500,
    monthSales: 185000,
    monthGrossProfit: 52000,
    completedSalesCount: 42,
    outstandingPayments: 8500,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockKpis }),
    });
  });

  it("renders the welcome heading", async () => {
    render(<DashboardPage />);
    expect(screen.getByText("Welcome to KMR Group")).toBeInTheDocument();
    await screen.findByText("Business Performance");
  });

  it("renders the business performance KPI section and metrics", async () => {
    render(<DashboardPage />);

    expect(await screen.findByText("Business Performance")).toBeInTheDocument();
    expect(screen.getByText("Asia/Kolkata (IST)")).toBeInTheDocument();
    expect(screen.getByText("Today's Sales")).toBeInTheDocument();
    expect(screen.getByText("Today's Gross Profit")).toBeInTheDocument();
    expect(screen.getByText("This Month's Sales")).toBeInTheDocument();
    expect(screen.getByText("This Month's Gross Profit")).toBeInTheDocument();
    expect(screen.getByText("Completed Sales")).toBeInTheDocument();
    expect(screen.getByText("Outstanding")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders module navigation cards", async () => {
    render(<DashboardPage />);
    await screen.findByText("Business Performance");

    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("Purchases")).toBeInTheDocument();
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Suppliers")).toBeInTheDocument();
    expect(screen.getByText("Reports")).toBeInTheDocument();
  });

  it("marks zero modules as coming soon when all are implemented", async () => {
    render(<DashboardPage />);
    await screen.findByText("Business Performance");

    const badges = screen.queryAllByText("Coming soon");
    expect(badges.length).toBe(0);
  });

  it("provides navigation links for all implemented modules", async () => {
    render(<DashboardPage />);
    await screen.findByText("Business Performance");

    expect(screen.getByRole("link", { name: /Inventory/i })).toHaveAttribute("href", "/inventory");
    expect(screen.getByRole("link", { name: /Sales/i })).toHaveAttribute("href", "/sales");
    expect(screen.getByRole("link", { name: /Purchases/i })).toHaveAttribute("href", "/purchases");
    expect(screen.getByRole("link", { name: /Customers/i })).toHaveAttribute("href", "/customers");
    expect(screen.getByRole("link", { name: /Suppliers/i })).toHaveAttribute("href", "/suppliers");
    expect(screen.getByRole("link", { name: /Reports/i })).toHaveAttribute("href", "/reports");
  });
});
