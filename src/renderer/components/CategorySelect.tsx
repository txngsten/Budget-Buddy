import React from 'react'
import type { Category } from '../../shared/types'
import { buildCategoryTree } from '../lib/categories'

interface Props {
  categories: Category[]
  value: number | ''
  onChange: (id: number | '') => void
  className?: string
}

export default function CategorySelect({ categories, value, onChange, className }: Props) {
  const active = categories.filter(c => !c.archived)
  const tree = buildCategoryTree(active)

  return (
    <select
      className={className ?? 'form-input'}
      value={value}
      onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
    >
      <option value="">Uncategorised</option>
      {tree.map(parent => {
        if (parent.children.length === 0) {
          return <option key={parent.id} value={parent.id}>{parent.name}</option>
        }
        return (
          <optgroup key={parent.id} label={parent.name}>
            <option value={parent.id}>{parent.name} (general)</option>
            {parent.children.map(child => (
              <option key={child.id} value={child.id}>&nbsp;&nbsp;{child.name}</option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )
}
