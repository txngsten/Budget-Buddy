/**
 * Verifies the shared category bucketing that drives the drill-downs on the
 * weekly/fortnightly/monthly column chart and the projections spend breakdown.
 * Run with: npx tsx scripts/test-drill-buckets.ts
 * Read-only — opens the DB in readonly mode.
 */
import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import {
  buildTopLevelSlices,
  buildDrillSlices,
  keyForTransaction,
} from '../src/renderer/lib/categoryBreakdown'
import type { Category, Transaction } from '../src/shared/types'

const dbPath = path.join(
  os.homedir(),
  'Library/Application Support/budget-buddy/budget-buddy.db'
)
const db = new Database(dbPath, { readonly: true })

const categories = db.prepare('SELECT * FROM categories').all() as Category[]
const transactions = db.prepare('SELECT * FROM transactions').all() as Transaction[]
const categoryMap = new Map(categories.map(c => [c.id, c]))
db.close()

let failures = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`  ✓ ${name}`)
  else { failures++; console.log(`  ✗ ${name} ${detail}`) }
}

/** Sum transactions per slice key the way the charts bucket them. */
function bucketTotals(txs: Transaction[], parent: Category | null): Map<string, number> {
  const totals = new Map<string, number>()
  for (const tx of txs) {
    const key = keyForTransaction(tx, categoryMap, parent)
    if (key === null) continue
    totals.set(key, (totals.get(key) ?? 0) + tx.amount)
  }
  return totals
}

for (const type of ['spend', 'income'] as const) {
  console.log(`--- ${type} ---`)
  const txs = transactions.filter(t => t.type === type)
  const slices = buildTopLevelSlices(txs, categoryMap)
  const totals = bucketTotals(txs, null)

  check(
    'every top-level slice has a matching bucket key',
    slices.every(s => totals.has(s.key)),
    `slices ${slices.map(s => s.key).join(',')} vs keys ${[...totals.keys()].join(',')}`
  )
  check(
    'bucketed totals equal the slice values',
    slices.every(s => totals.get(s.key) === s.value),
    slices.filter(s => totals.get(s.key) !== s.value).map(s => `${s.name}: ${totals.get(s.key)} vs ${s.value}`).join('; ')
  )
  check(
    'bucketing produces no keys beyond the slices',
    totals.size === slices.length,
    `(${totals.size} keys vs ${slices.length} slices)`
  )

  const drillable = slices.filter(s => s.topLevelId !== null && s.breakdownCount >= 2)
  console.log(`  (${drillable.length} of ${slices.length} slices are drillable)`)

  for (const s of drillable) {
    const parent = categoryMap.get(s.topLevelId!)!
    const sub = buildDrillSlices(txs, categoryMap, parent)
    const subTotals = bucketTotals(txs, parent)

    check(
      `drill "${s.name}": bucketed sub-totals equal the sub-slice values`,
      sub.every(x => subTotals.get(x.key) === x.value),
      sub.filter(x => subTotals.get(x.key) !== x.value).map(x => x.name).join(', ')
    )
    check(
      `drill "${s.name}": buckets sum back to the parent total`,
      [...subTotals.values()].reduce((a, b) => a + b, 0) === s.value
    )
    check(
      `drill "${s.name}": out-of-family transactions are excluded`,
      txs.filter(t => keyForTransaction(t, categoryMap, parent) !== null).length <
        txs.length || slices.length === 1
    )
  }
  console.log()
}

console.log('--- edge cases ---')
const someTx = transactions[0]
check(
  'uncategorised transactions bucket to "uncategorised" at the top level',
  keyForTransaction({ ...someTx, category_id: null }, categoryMap, null) === 'uncategorised'
)
check(
  'uncategorised transactions are excluded from any drill-down',
  categories
    .filter(c => c.parent_id === null)
    .every(p => keyForTransaction({ ...someTx, category_id: null }, categoryMap, p) === null)
)
check(
  'a transaction on a missing category falls back to "uncategorised"',
  keyForTransaction({ ...someTx, category_id: 99999 }, categoryMap, null) === 'uncategorised'
)

const parentWithChild = categories.find(
  p => p.parent_id === null && categories.some(c => c.parent_id === p.id)
)
if (parentWithChild) {
  const child = categories.find(c => c.parent_id === parentWithChild.id)!
  check(
    'a subcategory transaction rolls up to its parent at the top level',
    keyForTransaction({ ...someTx, category_id: child.id }, categoryMap, null) ===
      String(parentWithChild.id)
  )
  check(
    'a subcategory transaction keys to itself inside its parent drill',
    keyForTransaction({ ...someTx, category_id: child.id }, categoryMap, parentWithChild) ===
      String(child.id)
  )
  check(
    'a parent-level transaction keys to the parent inside its own drill',
    keyForTransaction({ ...someTx, category_id: parentWithChild.id }, categoryMap, parentWithChild) ===
      String(parentWithChild.id)
  )
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
