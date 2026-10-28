// The site-level "Demo" label (team decision 2026-10-28). On the demo deployment only, a thin strip
// tops every screen on all four sides, so judges always know it is a demo, also on Find, Cards and
// Help, where no hospital (and so no SAMPLE DATA tag, rule 1) is shown. The real site shows nothing.
export function DemoSiteBar() {
  return (
    <div data-testid="demo-site-tag" className="flex h-7 items-center justify-center bg-neutral-bg">
      <span role="note" aria-label="Demo site: hospitals and figures are sample data" className="text-small font-semibold text-neutral-ink">
        Demo
      </span>
    </div>
  );
}
