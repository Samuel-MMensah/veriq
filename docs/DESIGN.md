# Veriq design system

Prompt 10 set this up; Prompt 10c tightened it. One set of tokens and a few shared components for all four sides: patients, hospital staff, insurers and admin.

**The goal:** calm, professional, minimal. A finished product from a serious health company. Standard patterns, nothing clever. Less text, more clarity. Rules 4, 7 and 9 always win over looks:

- every fact keeps its source and time;
- touch targets stay at least 44 px;
- words stay plain.

![Design sample](design-sample.png)

The sample above is a live page: sign in as an admin and open `/admin/design`. Every token and component on it is the real one.

## Colour: for meaning only

| Meaning | Token (Tailwind class) | Value | Used for |
| --- | --- | --- | --- |
| Action, confirmed | `brand`, `brand-strong`, `brand-soft` | #0B6E4F, #08573F, #E8F2EE | The primary button; "hospital confirmed" and "patients confirmed" (told apart by icon); the selected state; good status words ("Open") |
| Refusals and warnings | `warn-bg`, `warn-ink` (and `refused`) | #FDF0E6, #8F3D07 | Refused (B1), "Closed", "Full", waiting, needs attention |
| Emergency | `emergency`, `danger-bg`, `danger-ink` | #8A1C12, #FDECEA | Emergency mode and the links to it. Nothing else is red. |
| Neutrals | `ink`, `muted`, `surface`, `page`, `line`, `line-strong`, `neutral-bg`, `neutral-ink` | #16201C, #4F5D57, #FFFFFF, #F4F6F5, #E2E7E5, #C9D1CE, #EEF1F0, #3F4B46 | Everything else: text, cards, borders, "not checked", "From 2 pm", switched-off accounts |

There are no other colours and no gradients. The light "patient" green and red badges are gone (Prompt 10c). Every tone pair passes WCAG AA. Colour never carries meaning alone: there is always a word, and usually an icon.

## Type: Plus Jakarta Sans, four sizes

| Size | Class | Size / line | Weight | Used for |
| --- | --- | --- | --- | --- |
| Page title | `text-title` | 24 / 32 | 700 | One per screen; big figures (KPI tiles, 112 and 193, one-time passwords) |
| Section title | `text-section` | 18 / 26 | 700 | Card and section headings, hospital names in lists |
| Body | (default) / `text-body` | 16 / 24 | 400; 600 for labels and buttons | Everything else. Inputs are never smaller (no zoom on phones) |
| Small | `text-small` | 14 / 20 | 400 or 600 | Source lines, hints, meta, badges, the SAMPLE DATA tag, tab labels |

The weights are 400, 600 and 700. Figures are tabular everywhere (`font-variant-numeric: tabular-nums` on `body`), so numbers line up in lists, tables and tiles. No other sizes are used: `text-xs`, `text-lg`, `text-xl` and up are gone from the app.

## Spacing, shape, icons, motion

- **Spacing:** an 8 px grid. 16 px side gutter on phones; 24 to 32 px on a laptop. Cards have 16 px padding. 8 to 16 px between cards, 24 px between sections. Desktop content is at most about 1200 px wide (form screens such as the morning check, about 670 px).
- **Cards:** one style. White, a hairline border (`shadow-card` is a 1 px line, no shadow), 12 px corners (`--radius-card`). Only raised things (dialogs, toasts, the emergency call buttons) cast a shadow.
- **Controls:** 12 px corners (`--radius-control`), 48 px tall; segmented controls and chips at least 44 px.
- **Badges:** one style. A pill in `text-small` 600, in a tone from the table above (`Badge`, `components/ui/Badge.tsx`).
- **Icons:** one set (`components/ui/Icon.tsx`), 24 px grid, 2 px stroke, round ends. Used sparingly: beside a badge answer, in navigation, on a call button, on empty states. Never decoration.
- **Motion:**
  - `animate-enter`: a 240 ms fade-up for result cards (staggered, at most 6), toasts, dialogs and the welcome points.
  - `animate-fade`: 160 ms.
  - `prefers-reduced-motion: reduce` turns every animation and transition off.

## Components (`components/ui/`, `components/staff/`)

| Component | What it is for |
| --- | --- |
| `Button` / `buttonClass` | Three kinds only: primary (one per screen), secondary, text. 48 px tall. With `href` it is a link. Labels are verbs: Search, Call, Publish, Save. |
| `Card` | The one card. An optional heading with something on the right. One idea per card. |
| `ListRow` | A row: title, detail, source line, a trailing badge, and a chevron when it opens a page. At least 56 px. |
| `Badge` | A state in words: Verified, Waiting, Switched off, Held. |
| `BadgeLine` (`components/badges`) | The rule B answer: answer first, then who said so and when, in the rule's own words. |
| `StatusLine` (`components/facility`) | The rule F status of one service, with a compact source ("Hospital · 40 min ago"). |
| `SourceLine` | Rule 4 under a list or fact, in one small line. |
| `EmptyState` | An icon, one line, one action. Never a dead end. |
| `Toast` | The answer to what you just did. Good news is `role=status`; errors are `role=alert`. |
| `ConfirmAction` (`Dialog.tsx`) | A secondary button that asks first, in a native `<dialog>`. It can ask why (for the admin log). |
| `Field` + `inputClass` | A label, an optional one-line hint, and an error tied to the control. |
| `LoadingCards` | Grey blocks while a page loads on 3G. No facts. |
| `SampleDataTag` | Rule 1. One per screen, always at the top right of the page header, in one style. |
| `DemoSiteBar` | The demo site only (VERIQ_DEMO_SITE=on): a 28 px grey strip reading "Demo" above every screen, on all four sides. The real site never shows it. |
| `StaffShell`, `StaffPageHeader`, `StaffBody` | The one frame for hospital staff, insurers and admin. See below. |
| `CentredCard` | Staff sign-in and gate screens: wordmark, title, the form. The demo login (rehearsal sites only) sits below. |

## Screen patterns

- **Patients (phone):** a white header with a back arrow, one title and one short line, and the SAMPLE DATA tag top right. One primary action per screen; on Find it is sticky above the bottom bar.
  - **Result cards:** name, area and distance, badge, one status line.
  - **The hospital page:** in sections. Your card, Today, Other cards, Report.
  - **Explanations:** they live on `/how-we-check`, linked once as "How we check".
- **Staff, insurers and admin (`StaffShell`):**
  - **Laptop:** a dark side bar with the wordmark ("veriq hospitals", "veriq insurers", "veriq admin"), the navigation, and who is signed in with Sign out.
  - **390 px:** a dark top bar with the same links as tabs.
  - **Every screen:** starts with `StaffPageHeader` (title, at most one short line, at most one action, the SAMPLE DATA tag).
  - **Insurers:** KPI tiles of equal height, the number first; tables with right-aligned numbers; no disabled placeholders.
  - **Admin:** a filter bar where a list is long (locations); row actions in one place; a confirmation dialog for anything destructive.
  - **The morning check:** one row per service with a segmented control, and a single "Publish" button.
- **States:**
  - Loading: skeletons (`loading.tsx`).
  - Empty: `EmptyState`.
  - Error: `app/error.tsx`, one line and "Try again".
  - Not found: `app/not-found.tsx`.
  - Offline: the report form says "Saved on your phone. It sends when you're back online."

## Checks

- **Accessibility and layout** (`tests/e2e/polish.spec.ts`): axe (WCAG 2.1 AA) on every screen, every target at least 44 px, and nothing scrolling sideways. Run at 390 px, and at 1280 px for the admin screens.
- **Speed** (`tests/e2e/perf.spec.ts`): keeps first content under 3 s on 3G. The team's target is under 1 s on the live site.
