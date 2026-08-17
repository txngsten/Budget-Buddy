/**
 * Verifies the category pie-chart aggregation against the live database.
 * Run with: npx tsx scripts/test-breakdown.ts
 * Read-only — opens the DB in readonly mode.
 */
import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import {
  buildTopLevelSlices,
  buildDrillSlices,
  resolveTopLevel,
} from '../src/renderer/lib/categoryBreakdown'
import { shadeColour } from '../src/renderer/lib/colours'
import type { Category, Transaction } from '../src/shared/types'

const dbPath = path.join(
  os.homedir(),
  'Library/Application Support/budget-buddy/budget-buddy.db'
)
const db = new Database(dbPath, { readonly: true })

const categories = db.prepare('SELECT * FROM categories').all() as Category[]
const transactions = db.prepare('SELECT * FROM transactions').all() as Transaction[]
const categoryMap = new Map(categories.map(c => [c.id, c]))

let failures = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`  ✓ ${name}`)
  } else {
    failures++
    console.log(`  ✗ ${name} ${detail}`)
  }
}

console.log(`DB: ${dbPath}`)
console.log(`${categories.length} categories, ${transactions.length} transactions\n`)

for (const type of ['spend', 'income'] as const) {
  console.log(`--- ${type} ---`)
  const txs = transactions.filter(t => t.type === type)
  const slices = buildTopLevelSlices(txs, categoryMap)

  const sliceTotal = slices.reduce((s, x) => s + x.value, 0)
  const txTotal = txs.reduce((s, x) => s + x.amount, 0)
  check(
    'top-level slices sum to the full transaction total',
    sliceTotal === txTotal,
    `(${sliceTotal} vs ${txTotal})`
  )

  check(
    'every slice is a top-level category or Uncategorised',
    slices.every(s => s.topLevelId === null || categoryMap.get(s.topLevelId)?.parent_id === null),
    ''
  )

  check(
    'slices sorted descending by value',
    slices.every((s, i) => i === 0 || slices[i - 1].value >= s.value)
  )

  check(
    'slice colours match their top-level category colour',
    slices.every(s =>
      s.topLevelId === null ? true : categoryMap.get(s.topLevelId)!.colour === s.colour
    )
  )

  // Cross-check each top-level total against a direct SQL rollup
  for (const s of slices) {
    if (s.topLevelId === null) continue
    const row = db.prepare(
      `SELECT COALESCE(SUM(t.amount), 0) AS total
         FROM transactions t
         JOIN categories c ON c.id = t.category_id
        WHERE t.type = ?
          AND COALESCE(c.parent_id, c.id) = ?`
    ).get(type, s.topLevelId) as { total: number }
    check(
      `SQL rollup matches for "${s.name}"`,
      row.total === s.value,
      `(sql ${row.total} vs slice ${s.value})`
    )
  }

  const uncat = slices.find(s => s.topLevelId === null)
  const sqlUncat = db.prepare(
    'SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE type = ? AND category_id IS NULL'
  ).get(type) as { total: number }
  check(
    'uncategorised total matches SQL',
    (uncat?.value ?? 0) === sqlUncat.total,
    `(slice ${uncat?.value ?? 0} vs sql ${sqlUncat.total})`
  )

  // Drill-down: every drillable slice must break down into the same total
  const drillable = slices.filter(s => s.topLevelId !== null && s.breakdownCount >= 2)
  console.log(`  (${drillable.length} of ${slices.length} slices are drillable)`)
  for (const s of drillable) {
    const parent = categoryMap.get(s.topLevelId!)!
    const sub = buildDrillSlices(txs, categoryMap, parent)
    const subTotal = sub.reduce((acc, x) => acc + x.value, 0)
    check(
      `drill "${s.name}" preserves total (${sub.length} sub-slices)`,
      subTotal === s.value,
      `(${subTotal} vs ${s.value})`
    )
    check(
      `drill "${s.name}" sub-slices all belong to it`,
      sub.every(x => resolveTopLevel(categoryMap.get(Number(x.key))!, categoryMap).id === parent.id)
    )
    check(
      `drill "${s.name}" colours are distinct`,
      new Set(sub.map(x => x.colour)).size === sub.length,
      `(${sub.map(x => x.colour).join(',')})`
    )
  }
  console.log()
}

// --- Edge cases ---
console.log('--- edge cases ---')
const emptySlices = buildTopLevelSlices([], categoryMap)
check('empty transaction list yields no slices', emptySlices.length === 0)

const orphan: Transaction = {
  id: -1, account_id: 1, title: 'orphan', type: 'spend',
  category_id: 99999, amount: 500, occurred_at: '2026-01-01T00:00:00.000Z',
  recurring_id: null, created_at: '', updated_at: '',
}
const orphanSlices = buildTopLevelSlices([orphan], categoryMap)
check(
  'transaction referencing a missing category falls back to Uncategorised',
  orphanSlices.length === 1 && orphanSlices[0].topLevelId === null && orphanSlices[0].value === 500
)

const parentOnly = categories.find(c => c.parent_id === null)!
const directTx: Transaction = { ...orphan, id: -2, category_id: parentOnly.id }
const childCat = categories.find(c => c.parent_id === parentOnly.id)
if (childCat) {
  const childTx: Transaction = { ...orphan, id: -3, category_id: childCat.id, amount: 300 }
  const mixed = buildDrillSlices([directTx, childTx], categoryMap, parentOnly)
  check(
    'drill includes a "(direct)" slice for transactions on the parent itself',
    mixed.some(s => s.name === `${parentOnly.name} (direct)` && s.value === 500) &&
    mixed.some(s => s.name === childCat.name && s.value === 300)
  )
}

check('shadeColour returns base colour at index 0', shadeColour('#FF6B6B', 0, 4) === '#FF6B6B')
check('shadeColour handles a single slice', shadeColour('#FF6B6B', 0, 1) === '#FF6B6B')
check(
  'shadeColour produces valid hex for every index',
  Array.from({ length: 8 }, (_, i) => shadeColour('#339AF0', i, 8)).every(c => /^#[0-9a-f]{6}$/i.test(c))
)
check('shadeColour tolerates a malformed colour', shadeColour('not-a-colour', 2, 4) === 'not-a-colour')

db.close()
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
