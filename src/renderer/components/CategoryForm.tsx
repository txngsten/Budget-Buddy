import React, { useState } from 'react'
import type { Category } from '../../shared/types'

interface Props {
  category?: Category
  categories?: Category[]
  parentCategory?: Category
  onSave: () => void
  onCancel: () => void
}

const DEFAULT_COLOURS = [
  '#FF6B6B', '#FF8E72', '#FFC94D', '#51CF66',
  '#20C997', '#339AF0', '#7950F2', '#E64980',
]

export default function CategoryForm({ category, categories = [], parentCategory, onSave, onCancel }: Props) {
  const [name, setName] = useState(category?.name ?? '')
  const [parentId, setParentId] = useState<number | null>(
    category?.parent_id ?? parentCategory?.id ?? null
  )

  const parentColour = parentId
    ? categories.find(c => c.id === parentId)?.colour ?? parentCategory?.colour
    : undefined
  const [colour, setColour] = useState(category?.colour ?? parentColour ?? DEFAULT_COLOURS[0])
  const [colourTouched, setColourTouched] = useState(false)
  const [error, setError] = useState('')

  const hasChildren = category
    ? categories.some(c => c.parent_id === category.id)
    : false

  const topLevelOptions = categories.filter(c =>
    c.parent_id === null && !c.archived && c.id !== category?.id
  )

  function handleParentChange(newParentId: number | null) {
    setParentId(newParentId)
    if (!colourTouched && newParentId) {
      const p = categories.find(c => c.id === newParentId)
      if (p) setColour(p.colour)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Name is required.')
      return
    }

    try {
      if (category) {
        await window.api.categories.update(category.id, {
          name: name.trim(),
          colour,
          parent_id: parentId,
        })
      } else {
        await window.api.categories.create({
          name: name.trim(),
          colour,
          parent_id: parentId,
          archived: 0,
        })
      }
      onSave()
    } catch (err: any) {
      setError(err.message ?? 'Failed to save category.')
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <input
          className="form-input"
          placeholder="Category name"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <select
          className="form-input"
          value={parentId ?? ''}
          onChange={e => handleParentChange(e.target.value ? Number(e.target.value) : null)}
          disabled={hasChildren}
          title={hasChildren ? 'Has subcategories — cannot nest under another category' : ''}
        >
          <option value="">Top-level</option>
          {topLevelOptions.map(c => (
            <option key={c.id} value={c.id}>Sub of: {c.name}</option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <div className="colour-picker">
          {DEFAULT_COLOURS.map(c => (
            <button
              key={c}
              type="button"
              className={`colour-swatch ${colour === c ? 'selected' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => { setColour(c); setColourTouched(true) }}
            />
          ))}
          <input
            type="color"
            className="colour-custom"
            value={colour}
            onChange={e => { setColour(e.target.value); setColourTouched(true) }}
            title="Custom colour"
          />
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          {category ? 'Save' : 'Create'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
