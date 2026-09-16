import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "@/components/layout/AppShell";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("AppShell", () => {
  it("renders main navigation, header, and children", () => {
    render(
      <AppShell>
        <div data-testid="main-content">Test Child Content</div>
      </AppShell>
    );

    expect(screen.getByTestId("main-content")).toBeInTheDocument();
    expect(screen.getAllByText("KMR Group").length).toBeGreaterThan(0);
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
    expect(screen.getByLabelText("Global quick search")).toBeInTheDocument();
  });

  it("toggles sidebar drawer when mobile hamburger menu is clicked", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const hamburgerBtn = screen.getByRole("button", { name: "Open navigation menu" });
    const sidebar = screen.getByLabelText("Sidebar navigation");

    // Initially collapsed on mobile (-translate-x-full)
    expect(sidebar.className).toContain("-translate-x-full");

    // Click hamburger button to open
    await user.click(hamburgerBtn);
    expect(sidebar.className).toContain("translate-x-0");

    // Click close button inside sidebar to close
    const closeBtn = screen.getByRole("button", { name: "Close navigation" });
    await user.click(closeBtn);
    expect(sidebar.className).toContain("-translate-x-full");
  });

  it("opens quick action menu and shows creation links", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const quickActionBtn = screen.getByRole("button", { name: "Quick action menu" });
    await user.click(quickActionBtn);

    expect(screen.getByText("New Sale / Invoice")).toBeInTheDocument();
    expect(screen.getByText("New Alignment Job")).toBeInTheDocument();
  });

  it("opens notifications popup with alert cards", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const notifBtn = screen.getByRole("button", { name: "Notifications" });
    await user.click(notifBtn);

    expect(screen.getByText("Operational Alerts")).toBeInTheDocument();
    expect(screen.getByText("Low Tyre Stock Alert")).toBeInTheDocument();
  });

  it("opens user account menu and displays role info and sign out button", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const userMenuBtn = screen.getByRole("button", { name: "User account" });
    await user.click(userMenuBtn);

    expect(screen.getByText("admin@skubase.local")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("renders only children without sidebar or header on /login", async () => {
    const nextNav = await import("next/navigation");
    vi.mocked(nextNav.usePathname).mockReturnValueOnce("/login");

    render(
      <AppShell>
        <div data-testid="login-content">Login Form</div>
      </AppShell>
    );

    expect(screen.getByTestId("login-content")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).toBeNull();
    expect(screen.queryByLabelText("Open navigation menu")).toBeNull();
    expect(screen.queryByLabelText("Sign out")).toBeNull();
  });
});
