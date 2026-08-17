import type { Transaction, Category } from '../../shared/types'
import { shadeColour } from './colours'

export const UNCATEGORISED_COLOUR = '#8e8e93'

export interface Slice {
  key: string
  name: string
  value: number
  colour: string
  /** id of the top-level category this slice represents; null when uncategorised */
  topLevelId: number | null
  /** how many distinct sub-buckets sit underneath — 2+ means it can be drilled into */
  breakdownCount: number
}

export function resolveTopLevel(cat: Category, categoryMap: Map<number, Category>): Category {
  if (cat.parent_id === null) return cat
  return categoryMap.get(cat.parent_id) ?? cat
}

/** Roll every transaction up to its top-level category (a subcategory counts toward its parent). */
export function buildTopLevelSlices(
  transactions: Transaction[],
  categoryMap: Map<number, Category>
): Slice[] {
  const totals = new Map<string, { name: string; value: number; colour: string; topLevelId: number | null }>()
  // distinct sub-buckets per top-level category, used to decide whether a slice can drill
  const breakdowns = new Map<string, Set<string>>()

  for (const tx of transactions) {
    const cat = tx.category_id ? categoryMap.get(tx.category_id) : null
    const top = cat ? resolveTopLevel(cat, categoryMap) : null
    const key = top ? String(top.id) : 'uncategorised'

    const entry = totals.get(key) ?? {
      name: top ? top.name : 'Uncategorised',
      value: 0,
      colour: top?.colour ?? UNCATEGORISED_COLOUR,
      topLevelId: top?.id ?? null,
    }
    entry.value += tx.amount
    totals.set(key, entry)

    const subs = breakdowns.get(key) ?? new Set<string>()
    subs.add(cat ? String(cat.id) : 'uncategorised')
    breakdowns.set(key, subs)
  }

  return Array.from(totals.entries())
    .map(([key, entry]) => ({
      key,
      ...entry,
      breakdownCount: breakdowns.get(key)?.size ?? 0,
    }))
    .sort((a, b) => b.value - a.value)
}

/**
 * Which slice a transaction belongs to, matching the slices produced above.
 * `parent === null` is the top-level view; otherwise it is the drill-down into that
 * category, and transactions outside that family return null (they are not charted).
 */
export function keyForTransaction(
  tx: Transaction,
  categoryMap: Map<number, Category>,
  parent: Category | null
): string | null {
  const cat = tx.category_id ? categoryMap.get(tx.category_id) : null

  if (parent === null) {
    if (!cat) return 'uncategorised'
    return String(resolveTopLevel(cat, categoryMap).id)
  }

  if (!cat) return null
  if (resolveTopLevel(cat, categoryMap).id !== parent.id) return null
  return String(cat.id)
}

/** Break a single top-level category down into its subcategories (plus its own direct transactions). */
export function buildDrillSlices(
  transactions: Transaction[],
  categoryMap: Map<number, Category>,
  parent: Category
): Slice[] {
  const totals = new Map<number, { name: string; value: number }>()

  for (const tx of transactions) {
    if (!tx.category_id) continue
    const cat = categoryMap.get(tx.category_id)
    if (!cat) continue
    if (resolveTopLevel(cat, categoryMap).id !== parent.id) continue

    const name = cat.id === parent.id ? `${parent.name} (direct)` : cat.name
    const entry = totals.get(cat.id) ?? { name, value: 0 }
    entry.value += tx.amount
    totals.set(cat.id, entry)
  }

  const sorted = Array.from(totals.entries()).sort((a, b) => b[1].value - a[1].value)

  // Subcategories usually inherit the parent's colour, so spread them across shades
  // of that colour to keep the family readable but the slices distinguishable.
  return sorted.map(([id, entry], i) => ({
    key: String(id),
    name: entry.name,
    value: entry.value,
    colour: shadeColour(parent.colour, i, sorted.length),
    topLevelId: parent.id,
    breakdownCount: 1,
  }))
}
