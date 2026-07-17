# Budget Buddy — Build Specification

**Status: Source of truth. All architectural and design decisions live here.**
A small, self-contained, offline personal budget tracker for macOS. Single user, no auth, no network, all data local. Currency is AUD only (formatting only — no conversion).

---

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Shell | Electron | Runs like a desktop app (Discord-style), no browser needed |
| UI | React + TypeScript | Vite for bundling |
| Charts | Recharts | Pies, lines, sparklines |
| Storage | SQLite via `better-sqlite3` | Single DB file in `app.getPath('userData')` |
| Drag & drop | `@dnd-kit/core` (or similar) | Landing page widget reordering |

**Architecture rule:** the Electron **main process owns the database**. The renderer never touches SQLite directly; all reads/writes go through a typed IPC layer (`ipcMain.handle` / `ipcRenderer.invoke`), exposed via a preload script with `contextIsolation: true` and `nodeIntegration: false`.

Suggested repo layout:

```
budget-buddy/
  src/
    main/          # Electron main process: window, DB, IPC handlers, recurring engine
      db/          # schema.sql, migrations, query modules
    preload/       # contextBridge API surface
    renderer/      # React app
      pages/       # Landing, Account, Projections, Settings
      components/  # widgets, modals, charts
      lib/         # formatting (AUD, dates), IPC client
  package.json
```

---

## 2. Data Model (SQLite)

All money values are stored as **integer cents**. All timestamps are ISO-8601 local time strings. Use `PRAGMA foreign_keys = ON`.

```sql
CREATE TABLE accounts (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,              -- free text, user-assigned (e.g. "Everyday", "Savings")
  seed_balance  INTEGER NOT NULL DEFAULT 0, -- cents; starting balance before any transactions
  sort_order    INTEGER NOT NULL,           -- landing page ordering (drag & drop)
  archived      INTEGER NOT NULL DEFAULT 0, -- 1 = hidden, data retained
  created_at    TEXT NOT NULL
);

CREATE TABLE categories (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  colour     TEXT NOT NULL,                 -- hex, user-assigned
  archived   INTEGER NOT NULL DEFAULT 0,    -- soft delete: hidden from new entry, kept on old rows
  created_at TEXT NOT NULL
);

CREATE TABLE transactions (
  id           INTEGER PRIMARY KEY,
  account_id   INTEGER NOT NULL REFERENCES accounts(id),
  title        TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('income','spend')),
  category_id  INTEGER REFERENCES categories(id),  -- nullable = "Uncategorised"
  amount       INTEGER NOT NULL CHECK (amount > 0),-- cents, always positive; sign implied by type
  occurred_at  TEXT NOT NULL,
  recurring_id INTEGER REFERENCES recurring_rules(id), -- set when auto-posted by the engine
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE recurring_rules (
  id           INTEGER PRIMARY KEY,
  account_id   INTEGER NOT NULL REFERENCES accounts(id),
  title        TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('income','spend')),
  category_id  INTEGER REFERENCES categories(id),
  amount       INTEGER NOT NULL CHECK (amount > 0),
  frequency    TEXT NOT NULL CHECK (frequency IN ('weekly','fortnightly','monthly','custom')),
  interval_days INTEGER,                    -- only when frequency = 'custom'
  start_date   TEXT NOT NULL,
  end_date     TEXT,                        -- nullable = runs forever
  last_posted  TEXT,                        -- date of most recent auto-post
  active       INTEGER NOT NULL DEFAULT 1
);
```

Derived values (never stored):
- **Account balance** = `seed_balance + Σ income − Σ spend` over that account's transactions.
- **Combined balance** = sum over all **non-archived** accounts.

Transfers between accounts: **no dedicated feature** — the user enters a spend in one account and an income in the other manually. Do not build transfer logic.

---

## 3. Recurring Engine

- Runs in the main process: **on app launch** and on a **daily timer** while the app stays open.
- For each active rule, compute all due occurrence dates after `last_posted` (or from `start_date`) up to and including today; insert one transaction per occurrence with `recurring_id` set; update `last_posted`.
- Monthly frequency: same day-of-month as `start_date`; clamp to last day of shorter months (e.g. 31st → 30 Apr).
- Posted transactions are **ordinary transactions**: fully editable and deletable afterwards. Editing or deleting a posted transaction never alters the rule; editing a rule only affects future postings.
- Catch-up behaviour: if the app was closed for a long period, post *all* missed occurrences (backfilled with their correct dates).

---

## 4. Screens

### 4.1 App Chrome / Sidebar

Persistent left sidebar:

- **Landing Page**
- **Accounts** (expandable)
  - one entry per non-archived account, each with an inline **“＋ Add Item”** shortcut that opens the Add Item modal pre-set to that account
- **Projections**
- **Settings** *(addition to the original doc — home for category, recurring-rule, and account management)*

There is no "Graphs and Summaries" page — dropped; account pages and Projections carry all visualisation.

### 4.2 Landing Page

Vertically stacked widgets, one per non-archived account, **drag-and-drop reorderable** (persist to `accounts.sort_order`). The topmost widget is always the **All Accounts combined summary** and cannot be moved. An **"Add Account"** button sits below the stack (or in the header).

Each widget contains:
- Account name (and type badge)
- Current balance
- Period selector: **Week / Fortnight / Month** (default Week), per-widget, persisted
- For the selected period-to-date: **Spent**, **Income**, **Net +/-** (with a % change figure)
- Mini sparkline of the running balance across the selected period, with a (start, end) range slider beneath it
- Net figure/sparkline coloured green when positive, red when negative

The combined widget shows the same layout aggregated across all non-archived accounts.

### 4.3 Add Item Modal

Opened from a sidebar “Add Item” shortcut or from an account page. A two-pane popup:

**Left — the entry form**
- Title (text, required)
- Type: Income / Spend toggle
- Category: dropdown of non-archived categories + “Uncategorised” + an inline “new category…” option (name + colour picker)
- Date & time (defaults to now)
- Amount (AUD; parsed to cents; must be > 0)
- Account selector (pre-filled from context, changeable)
- Save / Cancel

**Right — context charts for the selected account**
Two pie charts stacked vertically, each with its own (start, end) date-range control:
- **Income by category** for the range
- **Spend by category** for the range
Slices use each category's assigned colour. Charts update live as the range changes (they do not need to include the unsaved entry).

### 4.4 Account Page

For a single account:
1. **Header:** account name (+ type), edit affordance (rename, change type, adjust seed balance), archive button.
2. **Totals strip:** Total balance · Spend · Income · Net +/- (all-time by default, follows the selected date range below).
3. **Charts** sharing a single (start, end) date-range slider:
   - Income & spend **pie charts** by category
   - **Line graph** of running balance over the range
4. **Transactions list** (bottom, scrollable): newest first; each row shows date, title, category chip (coloured), account? no — amount signed and coloured. Row actions: **edit** (reopens Add Item modal pre-filled) and **delete** (confirm dialog).

### 4.5 Projections

Forecasting driven by two user controls:
- **Lookback** `y` days (presets 30 / 60 / 90 + custom)
- **Horizon** `x` days (presets 7 / 30 / 90 + custom)

**Method — pure historical average.** For each non-archived account and each category:
- daily spend rate = Σ spend over lookback ÷ y
- daily income rate = Σ income over lookback ÷ y
- project linearly across the horizon. (Recurring items need no special handling — they exist in history as posted transactions, so the averages capture them.)

**Display:**
- **Projected balance line chart**: one line per account plus a combined line, from today's balance to today + x. Toggle lines on/off.
- **Projected spend by category**: pie or horizontal bar of where the money goes over the horizon, in category colours.
- **Summary cards**: projected combined net over the horizon, biggest projected category, and per-account end balances (flag any account projected to go negative).
- If the lookback contains no data, show an empty state explaining more history is needed.

### 4.6 Settings

- **Categories:** list with name + colour swatch; create, rename, recolour, archive (soft delete — archived categories disappear from dropdowns but stay on existing transactions and in charts).
- **Recurring rules:** full CRUD; show next due date; toggle active.
- **Accounts:** full list including archived; edit, archive/unarchive. Archived accounts are hidden from the sidebar, landing page, combined totals, and projections, but their data is retained and visible here.

---

## 5. Conventions & Details

- **Money:** integer cents in DB and IPC; format with `Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })` at the display edge only.
- **Dates:** store ISO-8601 local; "week to date" style summaries use rolling periods ending now (last 7 / 14 / ~30 days), not calendar-aligned.
- **Deletes:** transactions hard-delete (with confirm); categories and accounts archive only.
- **Empty states:** every chart and list needs a sensible empty state (fresh install has zero data).
- **Validation:** amounts > 0; titles required; dates may be past or future (future-dated transactions are excluded from "current balance" until their date, or — simpler — included immediately; pick included-immediately and note it in the UI).
- **Single window,** min size ~1100×720, macOS packaging via `electron-builder` (`.dmg`, arm64 + x64).

---

## 6. Build Phases (suggested order for Claude Code)

1. **Scaffold:** Electron + Vite + React + TS, preload/IPC skeleton, SQLite bootstrap with schema + migration runner.
2. **Accounts & categories:** CRUD via Settings, seed balance, archiving.
3. **Transactions:** Add Item modal (left pane), edit/delete, account page transaction list, balance derivation.
4. **Landing page:** widgets, combined summary, period selector, sparkline, drag-and-drop ordering.
5. **Charts:** account page pies + line with date-range slider; Add Item modal right pane.
6. **Recurring engine:** rules CRUD, launch/daily posting, catch-up, monthly clamping.
7. **Projections:** rate computation, line chart, category breakdown, summary cards.
8. **Polish & packaging:** empty states, confirm dialogs, keyboard niceties, dark-mode-friendly palette, `electron-builder` .dmg.

Each phase should end in a runnable app (`npm run dev`) so progress is verifiable incrementally.

---

## 7. Defaults Chosen (flag to owner if any should change)

These were not explicitly specified and were resolved with the following defaults:
1. Archived accounts are excluded from combined totals and projections.
2. "Uncategorised" is allowed (category is optional on a transaction).
3. Summary periods are rolling (last N days), not calendar-aligned.
4. Future-dated transactions count toward balances immediately.
5. Recurring frequencies: weekly, fortnightly, monthly, custom every-N-days.
6. Editing a recurring rule affects future postings only; past posted transactions are untouched.
7. App follows macOS light/dark appearance.
