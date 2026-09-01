import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "@/components/ui/Card";

describe("Card", () => {
  it("renders children content", () => {
    render(<Card>Card content here</Card>);
    expect(screen.getByText("Card content here")).toBeInTheDocument();
  });

  it("renders title when provided", () => {
    render(<Card title="My Card">Content</Card>);
    expect(screen.getByText("My Card")).toBeInTheDocument();
  });

  it("does not render title section when no title", () => {
    const { container } = render(<Card>Content only</Card>);
    const headings = container.querySelectorAll("h3");
    expect(headings).toHaveLength(0);
  });
});
