/**
 * Renders CategoryPieChart with real database data to catch component-level crashes.
 * Run with: npx tsx scripts/test-render.tsx
 * Read-only.
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import CategoryPieChart from '../src/renderer/components/CategoryPieChart'
import type { Category, Transaction } from '../src/shared/types'

const dbPath = path.join(
  os.homedir(),
  'Library/Application Support/budget-buddy/budget-buddy.db'
)
const db = new Database(dbPath, { readonly: true })
const categories = db.prepare('SELECT * FROM categories').all() as Category[]
const transactions = db.prepare('SELECT * FROM transactions').all() as Transaction[]
db.close()

let failures = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`  ✓ ${name}`)
  else { failures++; console.log(`  ✗ ${name} ${detail}`) }
}

for (const type of ['spend', 'income'] as const) {
  console.log(`--- render: ${type} ---`)
  let html = ''
  try {
    html = renderToStaticMarkup(
      <CategoryPieChart
        transactions={transactions}
        categories={categories}
        type={type}
        title={`${type} by Category`}
      />
    )
    check('renders without throwing', true)
  } catch (e) {
    check('renders without throwing', false, String(e))
    continue
  }

  check('emits the side-legend container', html.includes('pie-legend'))
  check('does not emit a recharts bottom legend', !html.includes('recharts-legend-wrapper'))

  // Top-level names should be present; subcategory-only names should not
  const topNames = categories.filter(c => c.parent_id === null).map(c => c.name)
  const shown = topNames.filter(n => html.includes(`>${n}</span>`))
  check(`legend lists top-level categories (${shown.length} shown)`, shown.length > 0, `saw ${shown.join(', ')}`)

  const subNames = categories
    .filter(c => c.parent_id !== null && !topNames.includes(c.name))
    .map(c => c.name)
  const leaked = subNames.filter(n => html.includes(`>${n}</span>`))
  check('legend shows no subcategory names at the top level', leaked.length === 0, `leaked: ${leaked.join(', ')}`)

  check(
    'drillable legend entries are marked clickable',
    html.includes('pie-legend-item drillable')
  )
  console.log()
}

console.log('--- render: empty state ---')
const emptyHtml = renderToStaticMarkup(
  <CategoryPieChart transactions={[]} categories={categories} type="spend" title="Spend by Category" />
)
check('empty state renders a message', emptyHtml.includes('No spend data for this period.'))
check('empty state renders no legend', !emptyHtml.includes('pie-legend'))

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
