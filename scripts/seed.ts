import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const Database = require('./node_modules/better-sqlite3') as typeof import('better-sqlite3')
import path from 'path'
import os from 'os'
import fs from 'fs'

const userDataPath = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'budget-buddy'
)

if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true })
}

const dbPath = path.join(userDataPath, 'budget-buddy.db')
console.log(`Seeding database at: ${dbPath}`)

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

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

  CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_parent_name
    ON categories(COALESCE(parent_id, 0), name);

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

// Clear existing data
db.exec('DELETE FROM transactions')
db.exec('DELETE FROM recurring_rules')
db.exec('DELETE FROM categories')
db.exec('DELETE FROM accounts')

const now = new Date().toISOString()

// --- Accounts ---
const insertAccount = db.prepare(
  `INSERT INTO accounts (name, type, seed_balance, sort_order, archived, created_at)
   VALUES (?, ?, ?, ?, 0, ?)`
)

insertAccount.run('Everyday', 'Transaction', 250000, 0, now)   // $2,500
insertAccount.run('Savings', 'Savings', 1500000, 1, now)       // $15,000
insertAccount.run('Credit Card', 'Credit', -45000, 2, now)     // -$450

console.log('Created 3 accounts')

// --- Categories (parent + subcategories) ---
const insertCategory = db.prepare(
  `INSERT INTO categories (name, colour, parent_id, archived, created_at) VALUES (?, ?, ?, 0, ?)`
)

// Top-level
insertCategory.run('Groceries', '#FF6B6B', null, now)
insertCategory.run('Rent', '#339AF0', null, now)
insertCategory.run('Utilities', '#FF8E72', null, now)
insertCategory.run('Transport', '#FFC94D', null, now)
insertCategory.run('Entertainment', '#7950F2', null, now)
insertCategory.run('Dining Out', '#E64980', null, now)
insertCategory.run('Salary', '#51CF66', null, now)
insertCategory.run('Freelance', '#20C997', null, now)
insertCategory.run('Shopping', '#FF9F0A', null, now)

console.log('Created 9 top-level categories')

// Get parent IDs for subcategories
const allCats = db.prepare('SELECT id, name FROM categories').all() as { id: number; name: string }[]
const parentCatId = (name: string) => allCats.find(c => c.name === name)!.id

// Subcategories
insertCategory.run('Fresh Produce', '#FF6B6B', parentCatId('Groceries'), now)
insertCategory.run('Pantry', '#FF8585', parentCatId('Groceries'), now)
insertCategory.run('Streaming', '#7950F2', parentCatId('Entertainment'), now)
insertCategory.run('Events', '#9775FA', parentCatId('Entertainment'), now)
insertCategory.run('Public Transport', '#FFC94D', parentCatId('Transport'), now)
insertCategory.run('Fuel', '#FFD43B', parentCatId('Transport'), now)

console.log('Created 6 subcategories')

// Get all IDs
const accounts = db.prepare('SELECT id, name FROM accounts').all() as { id: number; name: string }[]
const categories = db.prepare('SELECT id, name, parent_id FROM categories').all() as { id: number; name: string; parent_id: number | null }[]

const acctId = (name: string) => accounts.find(a => a.name === name)!.id
const catId = (name: string) => categories.find(c => c.name === name)!.id

// --- Transactions ---
const insertTx = db.prepare(
  `INSERT INTO transactions (account_id, title, type, category_id, amount, occurred_at, recurring_id, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`
)

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(Math.floor(Math.random() * 14) + 8, Math.floor(Math.random() * 60), 0, 0)
  return d.toISOString()
}

const txData: [string, string, string, string, number][] = [
  // Salary (monthly, 2 months of history)
  ['Everyday', 'Monthly Salary', 'income', 'Salary', 5200_00],
  ['Everyday', 'Monthly Salary', 'income', 'Salary', 5200_00],

  // Rent
  ['Everyday', 'Rent Payment', 'spend', 'Rent', 1800_00],
  ['Everyday', 'Rent Payment', 'spend', 'Rent', 1800_00],

  // Groceries — using subcategories
  ['Everyday', 'Woolworths - Fruit & Veg', 'spend', 'Fresh Produce', 8523],
  ['Everyday', 'Coles - Fresh', 'spend', 'Fresh Produce', 6745],
  ['Everyday', 'Aldi', 'spend', 'Pantry', 4512],
  ['Everyday', 'Woolworths - Pantry', 'spend', 'Pantry', 9234],
  ['Everyday', 'Coles - Pantry', 'spend', 'Pantry', 5678],
  ['Everyday', 'Woolworths - Produce', 'spend', 'Fresh Produce', 7123],
  ['Everyday', 'Aldi', 'spend', 'Groceries', 3456],
  ['Everyday', 'Coles', 'spend', 'Groceries', 11234],
  ['Everyday', 'Woolworths', 'spend', 'Groceries', 6543],
  ['Everyday', 'Coles', 'spend', 'Groceries', 8765],

  // Utilities
  ['Everyday', 'Electricity Bill', 'spend', 'Utilities', 18500],
  ['Everyday', 'Water Bill', 'spend', 'Utilities', 7800],
  ['Everyday', 'Internet', 'spend', 'Utilities', 7999],

  // Transport — using subcategories
  ['Everyday', 'Opal Top Up', 'spend', 'Public Transport', 5000],
  ['Everyday', 'Uber', 'spend', 'Transport', 2345],
  ['Everyday', 'Opal Top Up', 'spend', 'Public Transport', 5000],
  ['Everyday', 'Petrol', 'spend', 'Fuel', 8500],

  // Entertainment — using subcategories
  ['Credit Card', 'Netflix', 'spend', 'Streaming', 1699],
  ['Credit Card', 'Spotify', 'spend', 'Streaming', 1299],
  ['Credit Card', 'Cinema Tickets', 'spend', 'Events', 3600],
  ['Credit Card', 'Concert Tickets', 'spend', 'Events', 12000],

  // Dining
  ['Everyday', 'Thai Takeaway', 'spend', 'Dining Out', 3200],
  ['Everyday', 'Coffee', 'spend', 'Dining Out', 550],
  ['Credit Card', 'Restaurant with friends', 'spend', 'Dining Out', 8500],
  ['Everyday', 'Lunch', 'spend', 'Dining Out', 1850],
  ['Everyday', 'Coffee', 'spend', 'Dining Out', 600],
  ['Everyday', 'Pizza Night', 'spend', 'Dining Out', 4500],

  // Shopping
  ['Credit Card', 'Amazon order', 'spend', 'Shopping', 4999],
  ['Credit Card', 'New shoes', 'spend', 'Shopping', 12900],
  ['Credit Card', 'Book', 'spend', 'Shopping', 2499],

  // Freelance income
  ['Everyday', 'Freelance Project - Logo', 'income', 'Freelance', 75000],
  ['Everyday', 'Freelance Project - Website', 'income', 'Freelance', 150000],

  // Transfer to savings (manual as per spec)
  ['Everyday', 'Transfer to Savings', 'spend', 'Rent', 200000],
  ['Savings', 'Transfer from Everyday', 'income', 'Rent', 200000],
]

// Spread transactions across the last 60 days
for (let i = 0; i < txData.length; i++) {
  const [acctName, title, type, catName, amount] = txData[i]
  const dayOffset = Math.floor((i / txData.length) * 58) + 1
  const date = daysAgo(dayOffset)
  insertTx.run(acctId(acctName), title, type, catId(catName), amount, date, now, now)
}

console.log(`Created ${txData.length} transactions`)

// --- Recurring Rules ---
const insertRule = db.prepare(
  `INSERT INTO recurring_rules (account_id, title, type, category_id, amount, frequency, interval_days, start_date, end_date, last_posted, active)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 1)`
)

const today = new Date().toISOString().slice(0, 10)
const thirtyDaysAgo = new Date()
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10)

insertRule.run(acctId('Everyday'), 'Monthly Salary', 'income', catId('Salary'), 520000, 'monthly', null, '2025-01-15', thirtyDaysAgoStr)
insertRule.run(acctId('Everyday'), 'Rent Payment', 'spend', catId('Rent'), 180000, 'monthly', null, '2025-01-01', thirtyDaysAgoStr)
insertRule.run(acctId('Credit Card'), 'Netflix', 'spend', catId('Streaming'), 1699, 'monthly', null, '2025-01-10', thirtyDaysAgoStr)
insertRule.run(acctId('Credit Card'), 'Spotify', 'spend', catId('Streaming'), 1299, 'monthly', null, '2025-01-05', thirtyDaysAgoStr)
insertRule.run(acctId('Everyday'), 'Opal Top Up', 'spend', catId('Public Transport'), 5000, 'fortnightly', null, '2025-01-06', thirtyDaysAgoStr)

console.log('Created 5 recurring rules')

db.close()
console.log('Done! Restart the app to see the data.')
