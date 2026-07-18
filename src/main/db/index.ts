import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.')
  }
  return db
}

export function initDb(): void {
  const dbPath = path.join(app.getPath('userData'), 'budget-buddy.db')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runSchema()
  runMigrations()
  runIndexes()
}

function runSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id            INTEGER PRIMARY KEY,
      name          TEXT NOT NULL,
      type          TEXT NOT NULL,
      seed_balance  INTEGER NOT NULL DEFAULT 0,
      sort_order    INTEGER NOT NULL,
      archived      INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      colour     TEXT NOT NULL,
      parent_id  INTEGER REFERENCES categories(id),
      archived   INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_rules (
      id            INTEGER PRIMARY KEY,
      account_id    INTEGER NOT NULL REFERENCES accounts(id),
      title         TEXT NOT NULL,
      type          TEXT NOT NULL CHECK (type IN ('income','spend')),
      category_id   INTEGER REFERENCES categories(id),
      amount        INTEGER NOT NULL CHECK (amount > 0),
      frequency     TEXT NOT NULL CHECK (frequency IN ('weekly','fortnightly','monthly','custom')),
      interval_days INTEGER,
      start_date    TEXT NOT NULL,
      end_date      TEXT,
      last_posted   TEXT,
      active        INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id           INTEGER PRIMARY KEY,
      account_id   INTEGER NOT NULL REFERENCES accounts(id),
      title        TEXT NOT NULL,
      type         TEXT NOT NULL CHECK (type IN ('income','spend')),
      category_id  INTEGER REFERENCES categories(id),
      amount       INTEGER NOT NULL CHECK (amount > 0),
      occurred_at  TEXT NOT NULL,
      recurring_id INTEGER REFERENCES recurring_rules(id),
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS migrations (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `)
}

function runIndexes(): void {
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_parent_name
      ON categories(COALESCE(parent_id, 0), name);
  `)
}

interface Migration {
  name: string
  up: () => void
}

function runMigrations(): void {
  const applied = new Set(
    (db.prepare('SELECT name FROM migrations').all() as { name: string }[])
      .map(r => r.name)
  )

  const migrations: Migration[] = [
    {
      name: '001_add_category_parent_id',
      up() {
        const hasParentId = (db.prepare("PRAGMA table_info(categories)").all() as { name: string }[])
          .some(col => col.name === 'parent_id')

        if (hasParentId) return

        db.pragma('foreign_keys = OFF')
        db.transaction(() => {
          db.exec(`ALTER TABLE categories RENAME TO categories_old`)
          db.exec(`
            CREATE TABLE categories (
              id         INTEGER PRIMARY KEY,
              name       TEXT NOT NULL,
              colour     TEXT NOT NULL,
              parent_id  INTEGER REFERENCES categories(id),
              archived   INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL
            )
          `)
          db.exec(`
            INSERT INTO categories (id, name, colour, archived, created_at)
            SELECT id, name, colour, archived, created_at FROM categories_old
          `)
          db.exec(`DROP TABLE categories_old`)
          db.exec(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_parent_name
            ON categories(COALESCE(parent_id, 0), name)
          `)
        })()
        db.pragma('foreign_keys = ON')
      },
    },
  ]

  for (const m of migrations) {
    if (applied.has(m.name)) continue
    m.up()
    db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)').run(m.name, new Date().toISOString())
  }
}
