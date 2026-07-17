PRAGMA foreign_keys = ON;

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
  name       TEXT NOT NULL UNIQUE,
  colour     TEXT NOT NULL,
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
