import React, { useState } from 'react'
import type { Account, Category, RecurringRule } from '../../shared/types'
import CategorySelect from './CategorySelect'

interface Props {
  accounts: Account[]
  categories: Category[]
  rule?: RecurringRule
  onSave: () => void
  onCancel: () => void
}

export default function RecurringRuleForm({ accounts, categories, rule, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(rule?.title ?? '')
  const [type, setType] = useState<'income' | 'spend'>(rule?.type ?? 'spend')
  const [accountId, setAccountId] = useState<number>(rule?.account_id ?? accounts[0]?.id ?? 0)
  const [categoryId, setCategoryId] = useState<number | ''>(rule?.category_id ?? '')
  const [amount, setAmount] = useState(rule ? (rule.amount / 100).toFixed(2) : '')
  const [frequency, setFrequency] = useState<RecurringRule['frequency']>(rule?.frequency ?? 'monthly')
  const [intervalDays, setIntervalDays] = useState(rule?.interval_days?.toString() ?? '')
  const [startDate, setStartDate] = useState(rule?.start_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(rule?.end_date?.slice(0, 10) ?? '')
  const [active, setActive] = useState(rule?.active ?? 1)
  const [error, setError] = useState('')

  const activeAccounts = accounts.filter(a => !a.archived)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!title.trim()) { setError('Title is required.'); return }
    if (!accountId) { setError('Select an account.'); return }

    const cents = Math.round(parseFloat(amount) * 100)
    if (isNaN(cents) || cents <= 0) { setError('Amount must be greater than $0.'); return }

    if (frequency === 'custom') {
      const days = parseInt(intervalDays)
      if (isNaN(days) || days <= 0) { setError('Interval days must be > 0.'); return }
    }

    const data = {
      account_id: accountId,
      title: title.trim(),
      type,
      category_id: categoryId === '' ? null : categoryId,
      amount: cents,
      frequency,
      interval_days: frequency === 'custom' ? parseInt(intervalDays) : null,
      start_date: startDate,
      end_date: endDate || null,
      active,
    }

    if (rule) {
      await window.api.recurringRules.update(rule.id, data)
    } else {
      await window.api.recurringRules.create(data)
    }

    onSave()
  }

  return (
    <form className="inline-form recurring-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <input
          className="form-input"
          placeholder="Title (e.g. Rent, Salary)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoFocus
        />
        <div className="toggle-group toggle-group-small">
          <button
            type="button"
            className={`toggle-btn ${type === 'spend' ? 'active spend' : ''}`}
            onClick={() => setType('spend')}
          >
            Spend
          </button>
          <button
            type="button"
            className={`toggle-btn ${type === 'income' ? 'active income' : ''}`}
            onClick={() => setType('income')}
          >
            Income
          </button>
        </div>
      </div>

      <div className="form-row">
        <select
          className="form-input"
          value={accountId}
          onChange={e => setAccountId(Number(e.target.value))}
        >
          {activeAccounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <CategorySelect
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
        />
        <input
          className="form-input form-input-short"
          placeholder="Amount ($)"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          inputMode="decimal"
        />
      </div>

      <div className="form-row">
        <select
          className="form-input"
          value={frequency}
          onChange={e => setFrequency(e.target.value as RecurringRule['frequency'])}
        >
          <option value="weekly">Weekly</option>
          <option value="fortnightly">Fortnightly</option>
          <option value="monthly">Monthly</option>
          <option value="custom">Custom (every N days)</option>
        </select>
        {frequency === 'custom' && (
          <input
            className="form-input form-input-short"
            placeholder="Days"
            value={intervalDays}
            onChange={e => setIntervalDays(e.target.value)}
            type="number"
            min="1"
          />
        )}
      </div>

      <div className="form-row">
        <label className="date-range-label">
          <span>Start</span>
          <input
            type="date"
            className="form-input form-input-date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </label>
        <label className="date-range-label">
          <span>End (optional)</span>
          <input
            type="date"
            className="form-input form-input-date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </label>
        <label className="recurring-active-toggle">
          <input
            type="checkbox"
            checked={active === 1}
            onChange={e => setActive(e.target.checked ? 1 : 0)}
          />
          <span>Active</span>
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          {rule ? 'Save' : 'Create'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
