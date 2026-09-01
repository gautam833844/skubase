import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPage from "@/app/settings/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("SettingsPage Component", () => {
  const mockSettingsData = {
    id: "shop-1",
    name: "Premier Tyre Hub",
    tagline: "Quality Service",
    address: "Plot 42, Mumbai",
    phoneNumber: "+91 98765 43210",
    email: "sales@premiertyres.in",
    website: "https://premiertyres.in",
    gstin: "27ABCDE1234F1Z5",
    billFooter: "Thank you for your business!",
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders settings form and loads initial values", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockSettingsData,
      }),
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Premier Tyre Hub")).toBeDefined();
      expect(screen.getByDisplayValue("+91 98765 43210")).toBeDefined();
      expect(screen.getByDisplayValue("27ABCDE1234F1Z5")).toBeDefined();
    });

    expect(screen.getByRole("button", { name: /Save Changes/i })).toBeDefined();
  });

  it("submits updated values and displays success confirmation message", async () => {
    const user = userEvent.setup();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockSettingsData,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ...mockSettingsData,
            name: "Premier Tyre Hub & Service",
          },
        }),
      });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Premier Tyre Hub")).toBeDefined();
    });

    const nameInput = screen.getByLabelText(/Business \/ Shop Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Premier Tyre Hub & Service");

    const saveBtn = screen.getByRole("button", { name: /Save Changes/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Business settings updated successfully/i)).toBeDefined();
    });
  });
});
