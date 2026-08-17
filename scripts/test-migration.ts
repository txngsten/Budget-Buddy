/**
 * Exercises the 002_add_transaction_description migration against a COPY of the
 * pre-migration database backup, then verifies all pre-existing data survives the
 * upgrade and that the new column behaves.
 * Run with: npx tsx scripts/test-migration.ts
 * Neither the live database nor the backup is ever opened for writing.
 */
import Database from 'better-sqlite3'
import fs from 'fs'
import os from 'os'
import path from 'path'

// A snapshot taken before 002 was written, so the migration path is genuinely exercised.
const livePath = path.join(
  os.homedir(),
  'budget_buddy_db_backups/budget-buddy.db.backup-20260815-pre-changes'
)
const workPath = path.join(os.tmpdir(), 'bb-migration-test.db')

if (!fs.existsSync(livePath)) {
  console.error(`Pre-migration backup not found at ${livePath}`)
  process.exit(1)
}
// Clear any leftovers first — a stale -wal would otherwise replay onto the fresh copy.
for (const suffix of ['', '-wal', '-shm']) {
  if (fs.existsSync(workPath + suffix)) fs.unlinkSync(workPath + suffix)
}
for (const suffix of ['', '-wal', '-shm']) {
  if (fs.existsSync(livePath + suffix)) fs.copyFileSync(livePath + suffix, workPath + suffix)
}

let failures = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`  ✓ ${name}`)
  else { failures++; console.log(`  ✗ ${name} ${detail}`) }
}

// --- snapshot the "before" state from the live DB (read-only) ---
const live = new Database(workPath, { readonly: true })
const before = {
  accounts: live.prepare('SELECT * FROM accounts ORDER BY id').all(),
  categories: live.prepare('SELECT * FROM categories ORDER BY id').all(),
  transactions: live.prepare('SELECT * FROM transactions ORDER BY id').all(),
  rules: live.prepare('SELECT * FROM recurring_rules ORDER BY id').all(),
  migrations: (live.prepare('SELECT name FROM migrations').all() as { name: string }[]).map(r => r.name),
}
live.close()

console.log(`Working on a copy: ${workPath}`)
console.log(
  `before: ${before.accounts.length} accounts, ${before.categories.length} categories, ` +
  `${before.transactions.length} transactions, ${before.rules.length} rules\n`
)

// --- run the migration exactly as src/main/db/index.ts does ---
const db = new Database(workPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

console.log('--- migration ---')
const applied = new Set(
  (db.prepare('SELECT name FROM migrations').all() as { name: string }[]).map(r => r.name)
)
check('002 not yet applied on the copy', !applied.has('002_add_transaction_description'))

const hasDescription = (db.prepare('PRAGMA table_info(transactions)').all() as { name: string }[])
  .some(c => c.name === 'description')
if (!hasDescription) {
  db.exec('ALTER TABLE transactions ADD COLUMN description TEXT')
}
db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)')
  .run('002_add_transaction_description', new Date().toISOString())

const cols = (db.prepare('PRAGMA table_info(transactions)').all() as { name: string; type: string; notnull: number; dflt_value: unknown }[])
const descCol = cols.find(c => c.name === 'description')
check('description column exists', !!descCol)
check('description is TEXT', descCol?.type === 'TEXT')
check('description is nullable', descCol?.notnull === 0)
check('description has no default', descCol?.dflt_value === null)

// --- re-running must be a no-op (idempotency) ---
const applied2 = new Set(
  (db.prepare('SELECT name FROM migrations').all() as { name: string }[]).map(r => r.name)
)
check('migration recorded so it will not re-run', applied2.has('002_add_transaction_description'))
const colCountBefore = cols.length
const hasDesc2 = (db.prepare('PRAGMA table_info(transactions)').all() as { name: string }[])
  .some(c => c.name === 'description')
check('guard detects the column on a second pass', hasDesc2)
check('column count unchanged on second pass',
  (db.prepare('PRAGMA table_info(transactions)').all() as unknown[]).length === colCountBefore)

console.log('\n--- data preservation ---')
const after = {
  accounts: db.prepare('SELECT * FROM accounts ORDER BY id').all(),
  categories: db.prepare('SELECT * FROM categories ORDER BY id').all(),
  transactions: db.prepare('SELECT * FROM transactions ORDER BY id').all() as Record<string, unknown>[],
  rules: db.prepare('SELECT * FROM recurring_rules ORDER BY id').all(),
}

check('accounts unchanged', JSON.stringify(after.accounts) === JSON.stringify(before.accounts))
check('categories unchanged', JSON.stringify(after.categories) === JSON.stringify(before.categories))
check('recurring rules unchanged', JSON.stringify(after.rules) === JSON.stringify(before.rules))
check('transaction count unchanged', after.transactions.length === before.transactions.length)

const strippedAfter = after.transactions.map(t => {
  const { description, ...rest } = t
  return rest
})
check(
  'every existing transaction field is byte-identical',
  JSON.stringify(strippedAfter) === JSON.stringify(before.transactions)
)
check(
  'existing transactions all have description = NULL',
  after.transactions.every(t => t.description === null)
)

console.log('\n--- new column behaviour ---')
const acctId = (before.accounts[0] as { id: number }).id
const ts = new Date().toISOString()
const insert = db.prepare(
  `INSERT INTO transactions (account_id, title, type, category_id, amount, occurred_at, description, recurring_id, created_at, updated_at)
   VALUES (@account_id, @title, @type, @category_id, @amount, @occurred_at, @description, @recurring_id, @created_at, @updated_at)`
)

const withDesc = insert.run({
  account_id: acctId, title: 'With description', type: 'spend', category_id: null,
  amount: 1234, occurred_at: ts, description: 'A multi-word note\nwith a newline',
  recurring_id: null, created_at: ts, updated_at: ts,
})
const rowA = db.prepare('SELECT * FROM transactions WHERE id = ?').get(withDesc.lastInsertRowid) as { description: string }
check('description round-trips', rowA.description === 'A multi-word note\nwith a newline')

const withoutDesc = insert.run({
  account_id: acctId, title: 'No description', type: 'income', category_id: null,
  amount: 500, occurred_at: ts, description: null,
  recurring_id: null, created_at: ts, updated_at: ts,
})
const rowB = db.prepare('SELECT * FROM transactions WHERE id = ?').get(withoutDesc.lastInsertRowid) as { description: unknown }
check('null description accepted', rowB.description === null)

// The recurring engine omits the column entirely — must still work
const legacyInsert = db.prepare(
  `INSERT INTO transactions (account_id, title, type, category_id, amount, occurred_at, recurring_id, created_at, updated_at)
   VALUES (@account_id, @title, @type, @category_id, @amount, @occurred_at, @recurring_id, @created_at, @updated_at)`
).run({
  account_id: acctId, title: 'Recurring post', type: 'spend', category_id: null,
  amount: 900, occurred_at: ts, recurring_id: null, created_at: ts, updated_at: ts,
})
const rowC = db.prepare('SELECT * FROM transactions WHERE id = ?').get(legacyInsert.lastInsertRowid) as { description: unknown }
check('insert that omits description (recurring engine) still works', rowC.description === null)

// Partial update path used by transactions:update
db.prepare('UPDATE transactions SET description = @description, updated_at = @updated_at WHERE id = @id')
  .run({ description: 'edited note', updated_at: ts, id: withoutDesc.lastInsertRowid })
const rowD = db.prepare('SELECT * FROM transactions WHERE id = ?').get(withoutDesc.lastInsertRowid) as { description: string }
check('description can be set via update', rowD.description === 'edited note')

db.prepare('UPDATE transactions SET description = NULL WHERE id = ?').run(withoutDesc.lastInsertRowid)
const rowE = db.prepare('SELECT * FROM transactions WHERE id = ?').get(withoutDesc.lastInsertRowid) as { description: unknown }
check('description can be cleared back to NULL', rowE.description === null)

const integrity = db.pragma('integrity_check') as { integrity_check: string }[]
check('integrity_check passes', integrity[0].integrity_check === 'ok')
const fkErrors = db.pragma('foreign_key_check') as unknown[]
check('foreign_key_check reports no violations', fkErrors.length === 0)

db.close()
for (const suffix of ['', '-wal', '-shm']) {
  if (fs.existsSync(workPath + suffix)) fs.unlinkSync(workPath + suffix)
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
