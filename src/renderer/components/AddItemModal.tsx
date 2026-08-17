import React, { useEffect, useState } from 'react'
import type { Account, Category, Transaction } from '../../shared/types'
import { parseDollars } from '../lib/format'
import CategoryPieChart from './CategoryPieChart'
import CategorySelect from './CategorySelect'
import DateRangeSlider from './DateRangeSlider'

interface Props {
  accounts: Account[]
  categories: Category[]
  presetAccountId?: number
  editTransaction?: Transaction
  onSave: () => void
  onClose: () => void
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default function AddItemModal({
  accounts,
  categories,
  presetAccountId,
  editTransaction,
  onSave,
  onClose,
}: Props) {
  const [title, setTitle] = useState(editTransaction?.title ?? '')
  const [description, setDescription] = useState(editTransaction?.description ?? '')
  const [type, setType] = useState<'income' | 'spend'>(editTransaction?.type ?? 'spend')
  const [categoryId, setCategoryId] = useState<number | ''>(editTransaction?.category_id ?? '')
  const [occurredAt, setOccurredAt] = useState(
    editTransaction ? editTransaction.occurred_at.slice(0, 16) : toLocalDatetimeStr(new Date())
  )
  const [amount, setAmount] = useState(editTransaction ? (editTransaction.amount / 100).toFixed(2) : '')
  const [accountId, setAccountId] = useState<number>(
    editTransaction?.account_id ?? presetAccountId ?? accounts[0]?.id ?? 0
  )
  const [error, setError] = useState('')

  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColour, setNewCatColour] = useState('#339AF0')
  const [newCatParentId, setNewCatParentId] = useState<number | null>(null)

  const [localCategories, setLocalCategories] = useState(categories)
  const [contextTxs, setContextTxs] = useState<Transaction[]>([])
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const [incomeStart, setIncomeStart] = useState(toDateStr(thirtyDaysAgo))
  const [incomeEnd, setIncomeEnd] = useState(toDateStr(new Date()))
  const [spendStart, setSpendStart] = useState(toDateStr(thirtyDaysAgo))
  const [spendEnd, setSpendEnd] = useState(toDateStr(new Date()))

  const topLevelCategories = localCategories.filter(c => !c.archived && c.parent_id === null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // The prop is loaded asynchronously by App, so it can arrive or change after this
  // modal has mounted; useState alone would keep the first snapshot forever. Anything
  // created via "New..." is persisted before we refetch, so a later prop update
  // already contains it and this can't lose an inline-created category.
  useEffect(() => {
    setLocalCategories(categories)
  }, [categories])

  useEffect(() => {
    loadContextTransactions()
  }, [accountId])

  async function loadContextTransactions() {
    if (!accountId) return
    const txs = await window.api.transactions.list({ account_id: accountId })
    setContextTxs(txs)
  }

  const incomeStartDate = new Date(incomeStart)
  incomeStartDate.setHours(0, 0, 0, 0)
  const incomeEndDate = new Date(incomeEnd)
  incomeEndDate.setHours(23, 59, 59, 999)
  const incomeTxs = contextTxs.filter(t => {
    const d = new Date(t.occurred_at)
    return d >= incomeStartDate && d <= incomeEndDate
  })

  const spendStartDate = new Date(spendStart)
  spendStartDate.setHours(0, 0, 0, 0)
  const spendEndDate = new Date(spendEnd)
  spendEndDate.setHours(23, 59, 59, 999)
  const spendTxs = contextTxs.filter(t => {
    const d = new Date(t.occurred_at)
    return d >= spendStartDate && d <= spendEndDate
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!title.trim()) { setError('Title is required.'); return }
    if (!accountId) { setError('Select an account.'); return }

    const cents = parseDollars(amount)
    if (cents === null || cents <= 0) { setError('Amount must be greater than $0.'); return }

    const data = {
      account_id: accountId,
      title: title.trim(),
      type,
      category_id: categoryId === '' ? null : categoryId,
      amount: cents,
      occurred_at: new Date(occurredAt).toISOString(),
      description: description.trim() || null,
      recurring_id: editTransaction?.recurring_id ?? null,
    }

    if (editTransaction) {
      await window.api.transactions.update(editTransaction.id, data)
    } else {
      await window.api.transactions.create(data)
    }

    onSave()
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCatName.trim()) return
    const cat = await window.api.categories.create({
      name: newCatName.trim(),
      colour: newCatColour,
      parent_id: newCatParentId,
      archived: 0,
    })
    setCategoryId(cat.id)
    setShowNewCategory(false)
    setNewCatName('')
    setNewCatParentId(null)
    setLocalCategories(await window.api.categories.list())
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editTransaction ? 'Edit Transaction' : 'Add Item'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-two-pane">
          <form className="modal-left" onSubmit={handleSubmit}>
            <div className="form-field">
              <label className="form-label">Title</label>
              <input
                className="form-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Groceries, Salary"
                autoFocus
              />
            </div>

            <div className="form-field">
              <label className="form-label">Description <span className="form-label-hint">(optional)</span></label>
              <textarea
                className="form-input form-textarea"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Any extra detail about this transaction"
                rows={2}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Type</label>
              <div className="toggle-group">
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

            <div className="form-field">
              <label className="form-label">Category</label>
              <div className="category-select-row">
                <CategorySelect
                  categories={localCategories}
                  value={categoryId}
                  onChange={setCategoryId}
                />
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => setShowNewCategory(!showNewCategory)}
                >
                  New...
                </button>
              </div>
              {showNewCategory && (
                <div className="inline-new-category">
                  <input
                    className="form-input"
                    placeholder="Category name"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                  />
                  <select
                    className="form-input"
                    value={newCatParentId ?? ''}
                    onChange={e => setNewCatParentId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Top-level</option>
                    {topLevelCategories.map(c => (
                      <option key={c.id} value={c.id}>Sub of: {c.name}</option>
                    ))}
                  </select>
                  <input
                    type="color"
                    value={newCatColour}
                    onChange={e => setNewCatColour(e.target.value)}
                    className="colour-custom"
                  />
                  <button type="button" className="btn btn-small btn-primary" onClick={handleCreateCategory}>
                    Add
                  </button>
                </div>
              )}
            </div>

            <div className="form-field">
              <label className="form-label">Date &amp; Time</label>
              <input
                className="form-input"
                type="datetime-local"
                value={occurredAt}
                onChange={e => setOccurredAt(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Amount (AUD)</label>
              <input
                className="form-input"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
            </div>

            <div className="form-field">
              <label className="form-label">Account</label>
              <select
                className="form-input"
                value={accountId}
                onChange={e => setAccountId(Number(e.target.value))}
              >
                {accounts.filter(a => !a.archived).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {error && <p className="form-error">{error}</p>}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editTransaction ? 'Save' : 'Add'}
              </button>
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
            </div>
          </form>

          <div className="modal-right">
            <div className="modal-right-chart">
              <DateRangeSlider
                start={incomeStart}
                end={incomeEnd}
                onChange={(s, e) => { setIncomeStart(s); setIncomeEnd(e) }}
              />
              <CategoryPieChart
                transactions={incomeTxs}
                categories={localCategories}
                type="income"
                title="Income by Category"
              />
            </div>
            <div className="modal-right-chart">
              <DateRangeSlider
                start={spendStart}
                end={spendEnd}
                onChange={(s, e) => { setSpendStart(s); setSpendEnd(e) }}
              />
              <CategoryPieChart
                transactions={spendTxs}
                categories={localCategories}
                type="spend"
                title="Spend by Category"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function toLocalDatetimeStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
