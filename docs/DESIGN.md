# DESIGN.md

Light, clean, minimal, structured. An enterprise data tool for government officers, not a marketing page. Light theme only.

## Direction
- Reference class: dense, calm, table-first government and enterprise tools. Information first, decoration never.
- Spend visual emphasis in one place: the risk score and its breakdown. Everything else stays quiet.
- Every element must carry information. If it only decorates, delete it.

## Tokens (`frontend/styles/tokens.css`, the only place values are defined)
```css
:root {
  --color-bg: #FFFFFF;
  --color-surface: #F6F7F8;
  --color-border: #DDE1E6;
  --color-text: #20242A;
  --color-text-muted: #5B636E;
  --color-accent: #1B5E4B;
  --color-accent-fg: #FFFFFF;
  --color-accent-subtle: #E8F2EE;
  --risk-high: #B42318;   --risk-high-bg: #FEF3F2;
  --risk-medium: #93370D; --risk-medium-bg: #FFFAEB;
  --risk-low: #067647;    --risk-low-bg: #ECFDF3;
  --radius-sm: 4px;       /* inputs, buttons, chips */
  --radius-md: 8px;       /* panels */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px; --space-12: 48px;
}
```
Tailwind is configured to expose only these tokens. No raw hex or arbitrary values in components. If a pair fails WCAG AA in the contrast script (P6.6), adjust the token, not the check.

**Type:** one family, Public Sans (via `next/font`, system-ui fallback). Weights 400, 500, 600.
Scale: 12/16 (meta), 14/20 (body, tables), 16/24 (section titles, 600), 22/30 (page title, 600), 28/36 (KPI numbers, 600). Numbers use `font-variant-numeric: tabular-nums`. Line length under 80 characters.

**Spacing:** 4px base, only the space tokens above. **Borders:** 1px `--color-border`. **Elevation:** none, except one shadow token for popovers. **Motion:** only responses to user action (expand, focus, confirm), 150ms ease. No entrance animations. Respect `prefers-reduced-motion`.

## Banned patterns (never ship these)
**Colour:** purple, indigo or violet-blue gradients; any gradient on text, buttons, backgrounds or borders; warm cream background with serif and terracotta accent; near-black background with neon accent; glow; coloured shadows; coloured left-border on cards; rainbow chips; default Tailwind blue as the accent.
**Layout:** marketing hero (giant headline plus two buttons); three identical feature cards; everything in rounded cards with the same soft shadow; cards inside cards; centred body text; oversized padding; bento grids; decorative blobs, dotted or noise backgrounds; decorative charts or sparklines that show nothing.
**Type:** Inter, Roboto or Arial as the "default look"; tracked ALL-CAPS eyebrow labels; one word of a headline accented; numbered `01 / 02 / 03` markers on content that is not a sequence; monospace for small data labels.
**Decoration:** emoji as icons; sparkles; icons inside coloured circles as bullets; stock illustrations; glassmorphism or backdrop blur; fake avatars; fake logos.
**Copy:** "Unlock", "Supercharge", "Seamless", "Effortless", "Elevate", "Empower", "Revolutionize"; "Welcome back" greetings; exclamation marks; em dashes in UI text; labels shaped `WORD — fragment`; meta strings joined with middle dots (`A · B · C`); `→` appended to buttons or links; invented statistics ("99.9%", "Trusted by"); lorem ipsum; names like "John Doe".
**Motion:** fade-up on every section; hover scale or lift on cards; count-up numbers; parallax; looping animation.
**Components:** toasts for things that belong inline; modals for things that belong on the page; tooltips hiding essential information; badges on everything; pill buttons; floating action buttons; theme toggle; chatbot bubble.
**Charts:** 3D; gradient fills; donuts for data that is not part-to-whole; default library colours; legends far from the data.

## Production-grade rules
1. **Structure:** top bar (product name left; week selector and synthetic-data badge right), then a page container, max width 1280, 24px gutters. Three screens, no sidebar.
2. **Hierarchy:** one page title per screen, section titles at 16/600, body at 14. Never more than three text levels.
3. **Table first:** rows 44px tall; text left-aligned; numbers right-aligned with tabular figures; units in the column header; sticky header; the whole row is a link and keyboard focusable; row hover uses `--color-surface`.
4. **Colour carries meaning:** the UI is neutral. Accent only for primary actions and links. Risk colours only for risk, and always with a text label ("High", "Medium", "Low"). Never colour alone.
5. **Borders over shadows:** panels are white with a 1px border on the `--color-surface` page background.
6. **Every number has context:** unit, period and week ("kg", "%", "week of 2 Nov 2026"). Large numbers use `en-IN` grouping.
7. **States:** loading uses a skeleton the same size as the content. Empty states say what is missing and give the next action. Errors say what failed and how to fix it, without apologising.
8. **Forms:** label above the input, helper text below, inline validation, primary button on the right with a verb label ("Save outcome").
9. **Accessibility:** AA contrast; 2px visible focus ring on `--color-accent`; full keyboard operation; semantic HTML; `aria-label` on icon-only buttons; reduced motion respected.
10. **Responsive:** designed for 1280, works at 768, tables scroll horizontally inside their container below that.
11. **Consistency:** one name per action across the flow; one component per concept.
12. **Icons:** `lucide-react` only, 16px, 1.5 stroke, only where they speed up scanning, always with a text label nearby.

## Screens
```
Dashboard
+--------------------------------------------------------------+
| Inspection priorities     [Week v]   Synthetic demo data     |
+--------------------------------------------------------------+
| [Shops monitored] [Flagged] [Confirmed rate] [Precision@K*]  |
| Filters: [District v] [Taluka v] [Band v]        [Run audit] |
| Rank | Shop | Taluka | Score | Main reasons      | 8-wk trend|
|  1   | ...  | ...    |  78   | Stock gap, ...    |  ~~~~     |
+--------------------------------------------------------------+
* on synthetic data

Shop detail
+--------------------------------------------------------------+
| < Back   FPS-00012  Mehsana Taluka 3        Score 78  High   |
+------------------------------+-------------------------------+
| Score breakdown (bars)       | Why this shop was flagged     |
| Trends vs peer median        | Evidence (with figures)       |
| Stock reconciliation         | What to check (checklist)     |
| Board vs records             | Record visit outcome (form)   |
+------------------------------+-------------------------------+
```

## Reusable blocks (`frontend/components/ui/`)
Build each once. Screens only compose blocks.
| Block | Job |
|---|---|
| AppShell | Top bar, container, banner slot |
| PageHeader | Title, optional actions |
| SyntheticBanner | "Synthetic demo data. No real shops or card holders." Always visible |
| KpiCard | Label, value, unit or context line |
| DataTable | Generic sortable, linkable-row table |
| RiskBadge | Band as text plus risk colours |
| SignalChip | Short signal name with points |
| FilterBar | Selects and a clear action |
| ScoreBreakdown | Horizontal bars; points sum to the score |
| TrendChart | One Recharts wrapper: shop line vs peer median |
| ReconcileTable | Opening, received, sold, closing, gap |
| EvidenceList | Statements with their figures |
| ChecklistPanel | Checkable verification steps with the reason |
| FeedbackForm | Outcome select, note, "Save outcome" |
| EmptyState, ErrorState, Skeleton | Standard states |

## Keep code small
- Screen files up to about 150 lines, blocks up to about 100.
- Screens fetch on the server and pass data down; client components only where there is interaction.
- Styling only through Tailwind classes mapped to tokens. No per-component CSS files.
- One `lib/format.ts` (numbers, dates, units), one `lib/api.ts` (all fetches, generated types).
- Pre-approved frontend dependencies: `recharts`, `lucide-react`, `clsx`, `openapi-typescript`. Nothing else without a Decision in `MEMORY.md`.

## Copy
Sentence case, plain words, active voice, dates as "2 Nov 2026".
- Page title: "Inspection priorities". Detail panels: "Why this shop was flagged", "What to check".
- Note under the explanation: "Written from the figures shown. Verify before acting." Source label: "AI-written" or "Standard text".
- Buttons: "Run audit", "Save outcome", "Clear filters".
- Empty: "No shops match these filters." Action: "Clear filters".
- Error: "Could not load shops. Check that the API is running at {url}, then retry."

## Before merging UI work
1. Screenshots at 1280 and 768 checked against the banned list.
2. Contrast script, axe and keyboard pass.
3. No hex values outside `tokens.css`. No duplicated blocks.
4. Remove one more element than you think you should.
