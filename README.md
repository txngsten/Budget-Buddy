# Budget Buddy

An offline personal budget tracker for macOS. Single user, no auth, no network — all data stays local in SQLite.

---

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- macOS (arm64 or x64)

---

## Demo Mode (Development)

Run the app with pre-populated sample data for testing and development.

### 1. Install dependencies

```bash
npm install
```

### 2. Rebuild native modules for Electron

```bash
npx @electron/rebuild -m . -o better-sqlite3
```

### 3. Seed the database with demo data

```bash
cd scripts && npm install && cd ..
npx tsx scripts/seed.ts
```

This creates (or overwrites) the SQLite database at:
```
~/Library/Application Support/budget-buddy/budget-buddy.db
```

The seed script populates accounts, categories (with subcategories), transactions spanning several months, and recurring rules.

### 4. Start the dev server

```bash
npm run dev
```

The Electron window opens with hot-reload enabled. Edits to renderer code reflect instantly; main process changes require a restart.

---

## Production Build (Distributable .dmg)

Build a standalone macOS application where data persists between sessions.

### 1. Install dependencies

```bash
npm install
```

### 2. Add an app icon (optional)

electron-builder looks for an icon file at `build/icon.icns`. To set a custom icon:

```bash
mkdir -p build
```

Then place your icon file at `build/icon.icns`.

**Creating an .icns file from a PNG:**

```bash
# Requires a 1024x1024 PNG source image
mkdir -p build/icon.iconset
sips -z 16 16     icon.png --out build/icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out build/icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out build/icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out build/icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out build/icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out build/icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out build/icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out build/icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out build/icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out build/icon.iconset/icon_512x512@2x.png
iconutil -c icns build/icon.iconset -o build/icon.icns
rm -rf build/icon.iconset
```

Or simply export an `.icns` from any icon editor (Sketch, Figma plugin, Image2icon, etc.) and place it at `build/icon.icns`.

### 3. Build the app

```bash
npm run build
```

This runs TypeScript compilation, Vite bundling, and electron-builder packaging in sequence. Output goes to the `release/` directory.

### 4. Find your distributable

After a successful build:

```
release/
  Budget Buddy-0.1.0-arm64.dmg   # Apple Silicon
  Budget Buddy-0.1.0-x64.dmg     # Intel
  mac-arm64/
    Budget Buddy.app              # Directly runnable app bundle
```

Double-click the `.dmg` to install, or run the `.app` directly from `release/mac-arm64/`.

### 5. Data persistence

The production app stores its database at:
```
~/Library/Application Support/budget-buddy/budget-buddy.db
```

This file persists across app restarts and updates. The app starts with a fresh empty database on first launch — no seed data is included in production builds.

To start fresh, delete the database file:
```bash
rm ~/Library/Application\ Support/budget-buddy/budget-buddy.db
```

---

## Project Structure

```
budget-buddy/
  src/
    main/           # Electron main process: window, DB, IPC handlers, recurring engine
      db/           # Schema, migrations, query modules
    preload/        # contextBridge API surface
    renderer/       # React app (Vite)
      pages/        # Landing, Account, Projections, Settings
      components/   # Widgets, modals, charts
      lib/          # Formatting (AUD, dates), IPC client utilities
    shared/         # TypeScript types shared between main and renderer
  scripts/          # seed.ts for demo data
  build/            # App icon (icon.icns) — create this directory
  release/          # Build output (gitignored)
```

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot-reload |
| `npm run build` | Full production build (compile + bundle + package) |
| `npx tsc --noEmit` | Type-check without emitting |
| `npx @electron/rebuild -m . -o better-sqlite3` | Rebuild native SQLite module for Electron |
| `npx tsx scripts/seed.ts` | Populate database with demo data |

---

## Troubleshooting

### `dlopen` error for better-sqlite3

If you see an architecture mismatch error (e.g. "mach-o file, but is an incompatible architecture"), rebuild the native module:

```bash
npx @electron/rebuild -m . -o better-sqlite3
```

### Database migration errors

If the app fails to start after a schema change, the migration runner handles upgrades automatically. If you encounter issues, delete the database and re-seed:

```bash
rm ~/Library/Application\ Support/budget-buddy/budget-buddy.db
npx tsx scripts/seed.ts
```
