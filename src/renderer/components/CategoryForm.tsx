import React, { useState } from 'react'
import type { Category } from '../../shared/types'

interface Props {
  category?: Category
  onSave: () => void
  onCancel: () => void
}

const DEFAULT_COLOURS = [
  '#FF6B6B', '#FF8E72', '#FFC94D', '#51CF66',
  '#20C997', '#339AF0', '#7950F2', '#E64980',
]

export default function CategoryForm({ category, onSave, onCancel }: Props) {
  const [name, setName] = useState(category?.name ?? '')
  const [colour, setColour] = useState(category?.colour ?? DEFAULT_COLOURS[0])
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Name is required.')
      return
    }

    if (category) {
      await window.api.categories.update(category.id, {
        name: name.trim(),
        colour,
      })
    } else {
      await window.api.categories.create({
        name: name.trim(),
        colour,
        archived: 0,
      })
    }

    onSave()
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
        <div className="colour-picker">
          {DEFAULT_COLOURS.map(c => (
            <button
              key={c}
              type="button"
              className={`colour-swatch ${colour === c ? 'selected' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColour(c)}
            />
          ))}
          <input
            type="color"
            className="colour-custom"
            value={colour}
            onChange={e => setColour(e.target.value)}
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
