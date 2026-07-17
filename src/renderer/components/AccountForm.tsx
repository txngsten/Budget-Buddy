import React, { useState } from 'react'
import type { Account } from '../../shared/types'
import { formatCents, parseDollars } from '../lib/format'

interface Props {
  account?: Account
  nextSortOrder: number
  onSave: () => void
  onCancel: () => void
}

export default function AccountForm({ account, nextSortOrder, onSave, onCancel }: Props) {
  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState(account?.type ?? '')
  const [seedBalance, setSeedBalance] = useState(
    account ? formatCents(account.seed_balance) : ''
  )
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Name is required.')
      return
    }

    const cents = parseDollars(seedBalance || '0')
    if (cents === null) {
      setError('Invalid seed balance amount.')
      return
    }

    if (account) {
      await window.api.accounts.update(account.id, {
        name: name.trim(),
        type: type.trim(),
        seed_balance: cents,
      })
    } else {
      await window.api.accounts.create({
        name: name.trim(),
        type: type.trim(),
        seed_balance: cents,
        sort_order: nextSortOrder,
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
          placeholder="Account name"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <input
          className="form-input"
          placeholder="Type (e.g. Everyday, Savings)"
          value={type}
          onChange={e => setType(e.target.value)}
        />
        <input
          className="form-input form-input-short"
          placeholder="Seed balance ($)"
          value={seedBalance}
          onChange={e => setSeedBalance(e.target.value)}
        />
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          {account ? 'Save' : 'Create'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
