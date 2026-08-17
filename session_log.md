# Session Log

## Session 3 — 2026-08-16 → 08-17

### Setup

- `better-sqlite3` was again compiled for x86_64 and failed to load under Electron (`incompatible architecture ... have 'x86_64', need 'arm64'`). Fixed with `npx @electron/rebuild -m . -o better-sqlite3`, same as Session 1. The `postinstall` script exists but the module had drifted back out of sync.
- `scripts/` has its own `node_modules` with a plain-Node build of `better-sqlite3`, which is why the `npx tsx scripts/*.ts` tests keep working after the Electron rebuild — Node resolves the nested copy first.

### Database Safety

- Backup taken **before any code was touched**: `~/budget_buddy_db_backups/budget-buddy.db.backup-20260815-pre-changes` (SHA1 `c4910bcd2ff7cf50f95637e91020faef5118b926`, verified identical to source)
- Second backup after the migration: `~/budget_buddy_db_backups/budget-buddy.db.backup-20260816-post-migration`
- All original data verified intact afterwards: 3 accounts, 33 categories, all 128 original transactions byte-identical, 7 recurring rules. `integrity_check` and `foreign_key_check` both clean.

---

### Phase 1 — Account Page Pie Charts: Top-Level Grouping + Drill-Down

The income/spend pies were rendering one slice per *subcategory* with a recharts legend underneath, which squashed the labels.

**New files:**
- `src/renderer/lib/categoryBreakdown.ts` — pure aggregation, extracted so it can be tested without a DOM:
  - `buildTopLevelSlices()` — rolls every transaction up to its top-level category (a subcategory counts toward its parent), colours by the top-level category's colour, sorts descending by value, and records `breakdownCount` (how many distinct sub-buckets sit underneath) to decide whether a slice is drillable
  - `buildDrillSlices()` — breaks one top-level category into its subcategories, including a `"<Parent> (direct)"` slice for transactions filed on the parent itself
  - `resolveTopLevel()` — subcategory → parent, with a fallback to the category itself if the parent row is missing
- `src/renderer/lib/colours.ts` — `shadeColour(base, index, count)`; hex→HSL→hex, walks lightness toward a 0.85 ceiling and desaturates slightly. Needed because subcategories inherit their parent's colour, so a drill-down pie would otherwise be a single flat colour. Returns the input unchanged for malformed colours.

**Changed:**
- `src/renderer/components/CategoryPieChart.tsx` — rewritten. Removed the recharts `<Legend>`; the legend is now a side list (dot / name / amount / percent). Slices and legend rows are clickable when the category has 2+ sub-buckets; clicking drills into a subcategory pie with a `← Back` button and the parent name in the title. `isAnimationActive={false}` so the pie doesn't re-animate on every drill.
- `src/renderer/styles.css` — `.pie-with-legend`, `.pie-legend*` (grid rows, scrollable, ellipsised names, tabular numerals); `.charts-row .chart-section` min-width 250px → 320px to fit the side legend.

**Note:** `CategoryPieChart` is shared with the Add Item modal's right pane, so those two pies got the same treatment.

---

### Phase 2 — Transaction `description` Field

Purely additive, nullable column — no table rebuild, existing rows untouched.

- `src/main/db/index.ts` — migration `002_add_transaction_description`: guards on `PRAGMA table_info`, then `ALTER TABLE transactions ADD COLUMN description TEXT`. Also added to the fresh-install `CREATE TABLE`.
- `src/shared/types.ts` — `description: string | null` on `Transaction`
- `src/main/ipc.ts` — `transactions:create` binds `@description` (defaults to `null`). `transactions:update` needed no change — it builds its `SET` clause from `Object.keys(data)`.
- `src/renderer/components/AddItemModal.tsx` — optional Description textarea below Title; empty input saves as `null`, not `''`
- `src/renderer/pages/AccountPage.tsx` — transaction rows now stack a `.transaction-info-main` line over the description; rows without one are unchanged
- `src/renderer/styles.css` — `.transaction-info` is now a column, plus `.transaction-description`, `.form-textarea`, `.form-label-hint`
- `src/main/db/schema.sql` — was stale (still pre-`parent_id`); brought in line with the live schema. Nothing reads this file; it is documentation only.
- `scripts/seed.ts` — `description` added to its `CREATE TABLE`

**Column ordering:** `ALTER TABLE` appends, so migrated DBs have `description` last while fresh installs have it after `occurred_at`. Harmless — every query binds by name.

---

### Phase 3 — Fix: `AddItemModal` Stale Category Snapshot *(follow-up request, 2026-08-17)*

`const [localCategories, setLocalCategories] = useState(categories)` seeded state from the prop once and never re-synced, so a modal that mounted before `App`'s async `categories.list()` resolved kept an empty list for its whole lifetime — the category dropdown was empty and both context pies collapsed into a single grey "Uncategorised" slice.

- `src/renderer/components/AddItemModal.tsx` — added `useEffect(() => setLocalCategories(categories), [categories])`

Safe against clobbering an inline-created category: `handleCreateCategory` awaits `categories.create()` before refetching, so the category is already persisted and any later prop update from `App` contains it. `App` holds `categories` in state and only replaces the array on reload, so the dependency doesn't fire spuriously.

**Verified** with the same repro that exposed it (force `showAddItem` true on `AccountPage` so the modal mounts before load): before, the income pie read "Uncategorised $1,803.47 100%" in grey; after, it reads "Income $1,803.47 100%" in its own colour and the spend pie shows the full coloured breakdown. No automated regression test — `renderToStaticMarkup` doesn't run effects, and jsdom/react-test-renderer aren't installed; adding one would mean taking on a test-harness dependency.

**Not a bug, checked while in there:** the `accounts[0]?.id ?? 0` fallback for the initial `accountId` is unreachable — both call sites (`App` and `AccountPage`) always pass `presetAccountId`.

---

### Tests Added (`scripts/`, run with `npx tsx`)

- `test-breakdown.ts` — aggregation against the live DB (read-only): slice totals cross-checked against a SQL `COALESCE(parent_id, c.id)` rollup, sort order, colour mapping, drill-down totals preserved, drill colours distinct, plus edge cases (empty list, transaction pointing at a missing category, `(direct)` slices, `shadeColour` bounds)
- `test-render.tsx` — server-renders `CategoryPieChart` with real data; asserts no throw, side legend present, no recharts bottom legend, only top-level names at the top level, drillable rows marked, and the empty state
- `test-migration.ts` — copies the **pre-migration backup**, runs migration 002, then verifies idempotency, column type/nullability/default, byte-identical preservation of every pre-existing row, and round-trip behaviour for set/null/omitted/updated/cleared descriptions. Clears stale `-wal`/`-shm` first, or a leftover WAL replays onto the fresh copy.

All pass, alongside `npx tsc --noEmit` and `npx vite build`.

### Verification in the Running App

Confirmed by screenshot: top-level pies with side legends, drill-down into Food (Eating Out / Groceries / Coffee) and Income (Bakery / Government / Sale Goods), the Description field in the Add Item modal, and a description rendering under a transaction row (via a temporary row, since deleted).

### Known Considerations

- Synthetic clicks (`CGEventPostToPid`) do not reach the Electron window while it sits on an inactive macOS Space, and the window stops repainting there — screenshots return a stale buffer. Workaround used: `touch src/main/index.ts` to force an Electron restart, which creates a freshly-painted window.
- Launching the app ran the recurring engine, which posted one due transaction (id 131, rule 7 "Claude", $34.00, dated 2026-08-15) and set that rule's `last_posted`. Normal catch-up behaviour, not a side effect of these changes.
- Several top-level categories share a colour in the current data (Food/Gift both `#339AF0`, Entertainment/Education both `#7950F2`), so those slices look alike. Left as-is — the colours are user-assigned in Settings, and the legend disambiguates by name and amount.

---

## Session 2 — 2026-07-19

### Changes Made

#### 1. README.md Created

- `README.md` — Detailed project README covering:
  - **Production build instructions**: full `npm run build` workflow producing `.dmg` and `.app` outputs in `release/`
  - **App icon setup**: step-by-step instructions using `sips` + `iconutil` to convert a 1024x1024 PNG into `build/icon.icns` for electron-builder
  - **Demo mode instructions**: install, rebuild native modules, seed database, run `npm run dev`
  - **Data persistence**: explains the shared DB path (`~/Library/Application Support/budget-buddy/budget-buddy.db`) used by both dev and production
  - **Project structure overview**, useful commands table, and troubleshooting section

#### Notes

- Production builds and dev mode share the same database path. If the seed script has been run, the built app will contain demo data. Delete the DB file to start fresh: `rm ~/Library/Application\ Support/budget-buddy/budget-buddy.db`

---

## Session 1 — 2026-07-18

## Changes Made

### 1. Nested Categories (1-level max)

Full cross-cutting implementation of parent/child categories throughout the app.

**Data Layer:**
- `src/shared/types.ts` — Added `parent_id: number | null` to `Category` interface, added `unarchive` method to `IpcApi.categories`
- `src/main/db/index.ts` — Updated schema for fresh installs (added `parent_id` column), added migration runner with `001_add_category_parent_id` migration that rebuilds the categories table for existing databases, added `runIndexes()` phase after migrations to create the composite unique index (avoids referencing `parent_id` before migration runs)
- `src/main/ipc.ts` — Updated `categories:list` ordering (groups parents with children), `categories:create`/`update` with depth validation (max 1 level), `categories:archive` cascades to children, added `categories:unarchive` (unarchiving a child also unarchives its parent)
- `src/preload/index.ts` — Added `categories.unarchive` bridge method

**Shared Utilities (new files):**
- `src/renderer/lib/categories.ts` — `buildCategoryTree()`, `getCategoryDisplayName()` helper ("Parent > Child" format)
- `src/renderer/components/CategorySelect.tsx` — Reusable `<select>` with `<optgroup>` nesting for category dropdowns

**UI Components Updated:**
- `src/renderer/components/CategoryForm.tsx` — Added parent selector dropdown, colour inheritance from parent, prevents nesting a category that already has children
- `src/renderer/pages/SettingsPage.tsx` — Categories displayed as nested tree with indented children, "+ Sub" button on each parent, unarchive support for categories
- `src/renderer/components/AddItemModal.tsx` — Uses `CategorySelect`, inline "new category" form includes parent selector
- `src/renderer/components/RecurringRuleForm.tsx` — Uses `CategorySelect`, removed unused `activeCategories` variable
- `src/renderer/pages/AccountPage.tsx` — Transaction chips show "Parent > Child" for subcategories
- `src/renderer/components/CategoryPieChart.tsx` — Slices show "Parent > Child" names, sorted to group related categories
- `src/renderer/pages/ProjectionsPage.tsx` — Category bar chart shows "Parent > Child" names

**Styles:**
- `src/renderer/styles.css` — Added `.settings-list-item--child` indentation with connector line

**Seed Data:**
- `scripts/seed.ts` — Updated schema, added 6 subcategories (Fresh Produce, Pantry under Groceries; Streaming, Events under Entertainment; Public Transport, Fuel under Transport), transactions and recurring rules use subcategories

---

### 2. Sidebar Account Indentation

- `src/renderer/styles.css` — Added `margin-left: 12px` and `font-size: 13px` to `.nav-account` so account entries are visually nested under the "Accounts" header and distinct from top-level nav items (Projections, Settings)

---

### 3. Landing Page Period Options Expanded

- `src/renderer/lib/periods.ts` — Extended `Period` type to include `'6month' | 'year' | 'all'`, updated `getPeriodDays`, `getPeriodStart` (accepts optional `allTimeAnchor`), and `getPeriodLabel`
- `src/renderer/components/AccountWidget.tsx` — Period selector now shows all 6 options: Week, Fortnight, Month, 6 Month, Year, All Time. "All Time" uses earliest transaction date as its start

---

### 4. Account Page: Category Spend Column Chart

- `src/renderer/pages/AccountPage.tsx` — Added `CategorySpendColumnChart` component below the balance line chart. Features:
  - Grouped bar chart (not stacked) — individual bars per category side-by-side
  - X axis: time buckets (week start dates, fortnight periods, or month labels)
  - Y axis: spend amount in AUD
  - Bars coloured by category colour
  - Toggle buttons: Weekly / Fortnightly / Monthly
  - Filtered by the account page's date range slider (uses `chartTransactions`)
  - Category legend below the chart
- `src/renderer/styles.css` — Added `.chart-title-row` for inline title + controls, `.category-legend` and `.category-legend-item`/`.category-legend-dot` for the legend

---

### 5. Fix: better-sqlite3 Architecture Mismatch

- Ran `npx @electron/rebuild -m . -o better-sqlite3` to rebuild the native module for arm64 (was compiled for x86_64)

---

## Current State

- App compiles cleanly (`npx tsc --noEmit` passes)
- All features working with `npm run dev` (after rebuild and running the migration)
- Database migration handles upgrading existing databases that lack `parent_id`
- Seed script updated for nested categories — run with `cd scripts && npm install && cd .. && npx tsx scripts/seed.ts`

## Known Considerations

- The `better-sqlite3` native module needs `npx @electron/rebuild` after `npm install` (there's a postinstall script for this)
- The migration runner disables foreign keys temporarily during the table rebuild — this is safe for single-user SQLite
- The composite unique index uses `COALESCE(parent_id, 0)` to enforce uniqueness among top-level categories (SQLite treats NULL as always unique otherwise)
