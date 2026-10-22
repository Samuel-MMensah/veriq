import { render, screen } from "@testing-library/react";
import { SampleDataTag } from "./SampleDataTag";
import { ScreenPlaceholder } from "./ScreenPlaceholder";

// Rule 1: data screens show a SAMPLE DATA tag.
describe("SampleDataTag (rule 1)", () => {
  it("shows the words SAMPLE DATA", () => {
    render(<SampleDataTag />);
    expect(screen.getByText("SAMPLE DATA")).toBeTruthy();
  });

  it("appears on a placeholder only when the screen has data", () => {
    const { rerender } = render(<ScreenPlaceholder title="Results" screen={2} prompt={4} sampleData />);
    expect(screen.queryByText("SAMPLE DATA")).toBeTruthy();
    rerender(<ScreenPlaceholder title="My cards" screen={5} prompt={6} />);
    expect(screen.queryByText("SAMPLE DATA")).toBeNull();
  });
});
