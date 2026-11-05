# DESIGN.md

Light, clean, minimal, structured. An enterprise data tool for government officers, not a marketing page. Light theme only.

## Direction
- Reference class: dense, calm, table-first government and enterprise tools. Information first, decoration never.
- Visual emphasis: risk scores, case statuses, and actionable decisions.
- Every element must carry information. If it only decorates, delete it.
- Never use modals for confirmations; use inline confirmation controls.

## Tokens (`frontend/styles/tokens.css`, single source of design values)
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
  --radius-sm: 4px;       /* inputs, buttons, chips, badges */
  --radius-md: 8px;       /* panels, cards */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px; --space-12: 48px;
}
```
Tailwind is configured exclusively to these tokens. No arbitrary hex values or unapproved Tailwind colors.

## Banned patterns (never ship these)
- **Colour:** purple, indigo, violet; gradients on text/buttons/backgrounds; dark mode; glow; rainbow chips; default Tailwind blue.
- **Layout:** marketing heroes; cards inside cards; centred body text; modals for actions or confirmations.
- **Type:** Inter/Roboto; tracked all-caps eyebrows; numbered decorative markers.
- **Decoration:** emojis as icons; sparkles; stock illustrations; glassmorphism; fake avatars.
- **Copy:** buzzwords ("Empower", "Revolutionize", "AI-driven", "Seamless"); exclamation marks; em dashes in UI text; arrows `->` on buttons; fake stats.
- **Motion:** fade-ups; bouncy transitions; hover card lift; parallax.
- **Components:** floating action buttons; modals; toasts hiding errors; theme toggle; chatbot widgets.

## Navigation and Scope Architecture
1. **Top Bar (`RoleNav`):** Displays application name, navigation links derived exclusively from the authenticated user's permissions, user profile dropdown (name, role badge, scope info, logout), and the persistent synthetic data disclaimer.
2. **Role Landing (`/`):** Redirects inspectors to `/queue`, supervisors/vigilance/admin to `/overview`.
3. **Synthetic Banner (`SyntheticBanner`):** Persistent banner stating "Synthetic demo data. No real shops or card holders." Present across all screens.

## Screens
- **Login (`/login`):** Email and password form, error banner, optional quick demo login shortcuts.
- **My Queue (`/queue`):** For inspectors. KPIs (Open, Overdue, Inspected, Confirmed Rate), sortable table of assigned cases with overdue badges.
- **Case Detail (`/cases/[id]`):** Case header (status, assignee, priority), `CaseActionBar` rendering actions only from `allowed_actions`, `OutcomeForm` for `record_outcome`, `ActionTimeline` displaying historical events, plus the full shop audit breakdown, trends, and reconciliation.
- **Inspection Priorities (`/flags`):** Ranked table of all flagged shops within user's scope.
- **Overview (`/overview`):** Jurisdiction KPIs, child area breakdown (taluka/district), cases by status, overdue counts.
- **Areas (`/areas`):** Performance table of areas (shops, flagged count, flag rate, open cases, overdue, confirmed rate).
- **Officers (`/officers`):** Table of officers in jurisdiction with assigned, open, overdue, and confirmed rate statistics.
- **Officer Detail (`/officers/[id]`):** Profile, access rights (role, scope, permission list), assigned flags, activity feed, and area flag rate.
- **Actions Feed (`/actions`):** Filterable chronological audit log of all case actions in scope.
- **Admin Users (`/admin/users`):** User management table, create user dialog, inline role/scope edits, inline deactivation and password reset.
- **Admin Audit Log (`/admin/audit`):** Immutable security access and change log.

## Reusable UI Blocks (`frontend/components/ui/`)
| Block | Job |
|---|---|
| `AppShell` | Header, `RoleNav`, persistent `SyntheticBanner`, main container |
| `RoleNav` | Role-aware navigation links and user profile display |
| `PageHeader` | Title, subtitle, contextual action buttons |
| `SyntheticBanner` | Persistent synthetic disclaimer |
| `KpiCard` | Metric number, label, context/subtext |
| `DataTable` | Accessible sortable table with full-row click support |
| `RiskBadge` | High, medium, low risk band indicators |
| `StatusBadge` | Case statuses: `new`, `assigned`, `in_progress`, `inspected`, `escalated`, `closed` |
| `CaseActionBar` | Action buttons dynamically populated from `allowed_actions` |
| `OutcomeForm` | Checklist inputs (ok/issue/not checked), action taken selector, notes |
| `ActionTimeline` | Chronological list of recorded case actions with actor, role, and timestamp |
| `AssigneeSelect` | Dropdown for case reassignment within permitted scope |
| `PermissionList` | Structured list of permissions and scope boundaries for an officer |
| `InlineConfirm` | Lightweight inline confirmation block (no modals) |
| `FilterBar` | Filter dropdowns and search inputs with clear button |
| `EmptyState`, `ErrorState`, `Skeleton` | Standard states |
