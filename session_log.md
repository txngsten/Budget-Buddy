# Session Log — 2026-07-18

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
