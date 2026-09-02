import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardPage from "@/app/page";

describe("DashboardPage", () => {
  it("renders the welcome heading", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Welcome to Skubase")).toBeInTheDocument();
  });

  it("renders future module cards", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("Purchases")).toBeInTheDocument();
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Suppliers")).toBeInTheDocument();
    expect(screen.getByText("Reports")).toBeInTheDocument();
  });

  it("marks zero modules as coming soon when all are implemented", () => {
    render(<DashboardPage />);
    const badges = screen.queryAllByText("Coming soon");
    expect(badges.length).toBe(0);
  });

  it("provides navigation links for all implemented modules", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("link", { name: /Inventory/i })).toHaveAttribute("href", "/inventory");
    expect(screen.getByRole("link", { name: /Sales/i })).toHaveAttribute("href", "/sales");
    expect(screen.getByRole("link", { name: /Purchases/i })).toHaveAttribute("href", "/purchases");
    expect(screen.getByRole("link", { name: /Customers/i })).toHaveAttribute("href", "/customers");
    expect(screen.getByRole("link", { name: /Suppliers/i })).toHaveAttribute("href", "/suppliers");
    expect(screen.getByRole("link", { name: /Reports/i })).toHaveAttribute("href", "/reports");
  });
});
