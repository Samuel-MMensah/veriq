import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { BottomBar } from "./BottomBar";

let pathname = "/cards";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

describe("BottomBar", () => {
  beforeEach(() => {
    pathname = "/cards";
  });

  it("has Find, Cards, Saved and Help in that order", () => {
    render(<BottomBar />);
    const labels = screen.getAllByRole("link").map((a) => a.textContent);
    expect(labels).toEqual(["Find", "Cards", "Saved", "Help"]);
  });

  it("marks the current tab", () => {
    render(<BottomBar />);
    expect(screen.getByRole("link", { name: "Cards" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Find" }).getAttribute("aria-current")).toBeNull();
  });

  it("is hidden on first open (screen 7)", () => {
    pathname = "/";
    render(<BottomBar />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
