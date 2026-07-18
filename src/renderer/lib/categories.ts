import type { Category } from '../../shared/types'

export interface CategoryWithChildren extends Category {
  children: Category[]
}

export function buildCategoryTree(categories: Category[]): CategoryWithChildren[] {
  const parents = categories.filter(c => c.parent_id === null)
  const childMap = new Map<number, Category[]>()
  for (const c of categories) {
    if (c.parent_id !== null) {
      const siblings = childMap.get(c.parent_id) ?? []
      siblings.push(c)
      childMap.set(c.parent_id, siblings)
    }
  }
  return parents.map(p => ({ ...p, children: childMap.get(p.id) ?? [] }))
}

export function getCategoryDisplayName(
  cat: Category,
  categoryMap: Map<number, Category>
): string {
  if (cat.parent_id) {
    const parent = categoryMap.get(cat.parent_id)
    return parent ? `${parent.name} > ${cat.name}` : cat.name
  }
  return cat.name
}
