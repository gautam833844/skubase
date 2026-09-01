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

  it("marks all modules as coming soon", () => {
    render(<DashboardPage />);
    const badges = screen.getAllByText("Coming soon");
    expect(badges.length).toBe(6);
  });
});
