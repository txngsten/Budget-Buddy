import React, { useEffect, useState } from 'react'
import type { Account, Category, RecurringRule } from '../../shared/types'
import AccountForm from '../components/AccountForm'
import CategoryForm from '../components/CategoryForm'
import RecurringRuleForm from '../components/RecurringRuleForm'
import { formatAud } from '../lib/format'
import { buildCategoryTree, getCategoryDisplayName } from '../lib/categories'

interface Props {
  onDataChanged: () => void
}

export default function SettingsPage({ onDataChanged }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [addSubcategoryParent, setAddSubcategoryParent] = useState<Category | null>(null)
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null)
  const [showNewRule, setShowNewRule] = useState(false)

  useEffect(() => {
    loadAccounts()
    loadCategories()
    loadRules()
  }, [])

  async function loadAccounts() {
    setAccounts(await window.api.accounts.list())
  }

  async function loadCategories() {
    setCategories(await window.api.categories.list())
  }

  async function loadRules() {
    setRules(await window.api.recurringRules.list())
  }

  async function handleArchiveAccount(id: number) {
    await window.api.accounts.archive(id)
    loadAccounts()
    onDataChanged()
  }

  async function handleUnarchiveAccount(id: number) {
    await window.api.accounts.unarchive(id)
    loadAccounts()
    onDataChanged()
  }

  async function handleArchiveCategory(id: number) {
    await window.api.categories.archive(id)
    loadCategories()
    onDataChanged()
  }

  async function handleUnarchiveCategory(id: number) {
    await window.api.categories.unarchive(id)
    loadCategories()
    onDataChanged()
  }

  async function handleDeleteRule(id: number) {
    await window.api.recurringRules.delete(id)
    loadRules()
  }

  async function handleToggleRule(rule: RecurringRule) {
    await window.api.recurringRules.update(rule.id, { active: rule.active ? 0 : 1 })
    loadRules()
  }

  const activeAccounts = accounts.filter(a => !a.archived)
  const archivedAccounts = accounts.filter(a => a.archived)
  const activeCategories = categories.filter(c => !c.archived)
  const archivedCategories = categories.filter(c => c.archived)
  const accountMap = new Map(accounts.map(a => [a.id, a]))
  const categoryMap = new Map(categories.map(c => [c.id, c]))

  const activeCategoryTree = buildCategoryTree(activeCategories)
  const archivedCategoryTree = buildCategoryTree(archivedCategories)

  function getNextDueDate(rule: RecurringRule): string {
    if (!rule.active) return 'Inactive'
    const last = rule.last_posted ?? rule.start_date
    const lastDate = new Date(last.slice(0, 10) + 'T00:00:00')
    let next: Date

    switch (rule.frequency) {
      case 'weekly':
        next = new Date(lastDate)
        next.setDate(next.getDate() + 7)
        break
      case 'fortnightly':
        next = new Date(lastDate)
        next.setDate(next.getDate() + 14)
        break
      case 'monthly': {
        const startDay = new Date(rule.start_date.slice(0, 10) + 'T00:00:00').getDate()
        next = new Date(lastDate)
        next.setMonth(next.getMonth() + 1)
        const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
        next.setDate(Math.min(startDay, maxDay))
        break
      }
      case 'custom':
        next = new Date(lastDate)
        next.setDate(next.getDate() + (rule.interval_days ?? 1))
        break
      default:
        return 'Unknown'
    }

    if (!rule.last_posted) {
      next = new Date(rule.start_date.slice(0, 10) + 'T00:00:00')
    }

    return next.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="settings-page">
      <h2>Settings</h2>

      <section className="settings-section">
        <div className="settings-section-header">
          <h3>Accounts</h3>
          <button className="btn btn-primary" onClick={() => setShowNewAccount(true)}>
            Add Account
          </button>
        </div>

        {showNewAccount && (
          <AccountForm
            onSave={() => { setShowNewAccount(false); loadAccounts(); onDataChanged() }}
            onCancel={() => setShowNewAccount(false)}
            nextSortOrder={accounts.length}
          />
        )}

        {editingAccount && (
          <AccountForm
            account={editingAccount}
            onSave={() => { setEditingAccount(null); loadAccounts(); onDataChanged() }}
            onCancel={() => setEditingAccount(null)}
            nextSortOrder={accounts.length}
          />
        )}

        <div className="settings-list">
          {activeAccounts.map(account => (
            <div key={account.id} className="settings-list-item">
              <div className="settings-list-item-info">
                <span className="settings-list-item-name">{account.name}</span>
                <span className="settings-list-item-meta">{account.type}</span>
              </div>
              <div className="settings-list-item-actions">
                <button className="btn btn-small" onClick={() => setEditingAccount(account)}>Edit</button>
                <button className="btn btn-small btn-danger" onClick={() => handleArchiveAccount(account.id)}>Archive</button>
              </div>
            </div>
          ))}
          {activeAccounts.length === 0 && !showNewAccount && (
            <p className="settings-empty">No accounts yet. Create one to get started.</p>
          )}
        </div>

        {archivedAccounts.length > 0 && (
          <>
            <h4 className="settings-archived-header">Archived</h4>
            <div className="settings-list">
              {archivedAccounts.map(account => (
                <div key={account.id} className="settings-list-item archived">
                  <div className="settings-list-item-info">
                    <span className="settings-list-item-name">{account.name}</span>
                    <span className="settings-list-item-meta">{account.type}</span>
                  </div>
                  <div className="settings-list-item-actions">
                    <button className="btn btn-small" onClick={() => handleUnarchiveAccount(account.id)}>Unarchive</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="settings-section">
        <div className="settings-section-header">
          <h3>Categories</h3>
          <button className="btn btn-primary" onClick={() => { setShowNewCategory(true); setAddSubcategoryParent(null) }}>
            Add Category
          </button>
        </div>

        {showNewCategory && (
          <CategoryForm
            categories={categories}
            parentCategory={addSubcategoryParent ?? undefined}
            onSave={() => { setShowNewCategory(false); setAddSubcategoryParent(null); loadCategories(); onDataChanged() }}
            onCancel={() => { setShowNewCategory(false); setAddSubcategoryParent(null) }}
          />
        )}

        {editingCategory && (
          <CategoryForm
            category={editingCategory}
            categories={categories}
            onSave={() => { setEditingCategory(null); loadCategories(); onDataChanged() }}
            onCancel={() => setEditingCategory(null)}
          />
        )}

        <div className="settings-list">
          {activeCategoryTree.map(parent => (
            <React.Fragment key={parent.id}>
              <div className="settings-list-item">
                <div className="settings-list-item-info">
                  <span className="category-swatch" style={{ backgroundColor: parent.colour }} />
                  <span className="settings-list-item-name">{parent.name}</span>
                  {parent.children.length > 0 && (
                    <span className="settings-list-item-meta">{parent.children.length} sub</span>
                  )}
                </div>
                <div className="settings-list-item-actions">
                  <button className="btn btn-small" onClick={() => {
                    setAddSubcategoryParent(parent)
                    setShowNewCategory(true)
                  }}>+ Sub</button>
                  <button className="btn btn-small" onClick={() => setEditingCategory(parent)}>Edit</button>
                  <button className="btn btn-small btn-danger" onClick={() => handleArchiveCategory(parent.id)}>Archive</button>
                </div>
              </div>
              {parent.children.map(child => (
                <div key={child.id} className="settings-list-item settings-list-item--child">
                  <div className="settings-list-item-info">
                    <span className="category-swatch" style={{ backgroundColor: child.colour }} />
                    <span className="settings-list-item-name">{child.name}</span>
                  </div>
                  <div className="settings-list-item-actions">
                    <button className="btn btn-small" onClick={() => setEditingCategory(child)}>Edit</button>
                    <button className="btn btn-small btn-danger" onClick={() => handleArchiveCategory(child.id)}>Archive</button>
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}
          {activeCategories.length === 0 && !showNewCategory && (
            <p className="settings-empty">No categories yet. Create one to organise your transactions.</p>
          )}
        </div>

        {archivedCategories.length > 0 && (
          <>
            <h4 className="settings-archived-header">Archived</h4>
            <div className="settings-list">
              {archivedCategoryTree.map(parent => (
                <React.Fragment key={parent.id}>
                  <div className="settings-list-item archived">
                    <div className="settings-list-item-info">
                      <span className="category-swatch" style={{ backgroundColor: parent.colour }} />
                      <span className="settings-list-item-name">{parent.name}</span>
                    </div>
                    <div className="settings-list-item-actions">
                      <button className="btn btn-small" onClick={() => handleUnarchiveCategory(parent.id)}>Unarchive</button>
                    </div>
                  </div>
                  {parent.children.map(child => (
                    <div key={child.id} className="settings-list-item settings-list-item--child archived">
                      <div className="settings-list-item-info">
                        <span className="category-swatch" style={{ backgroundColor: child.colour }} />
                        <span className="settings-list-item-name">{child.name}</span>
                      </div>
                      <div className="settings-list-item-actions">
                        <button className="btn btn-small" onClick={() => handleUnarchiveCategory(child.id)}>Unarchive</button>
                      </div>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="settings-section">
        <div className="settings-section-header">
          <h3>Recurring Rules</h3>
          <button className="btn btn-primary" onClick={() => setShowNewRule(true)}>
            Add Rule
          </button>
        </div>

        {showNewRule && (
          <RecurringRuleForm
            accounts={accounts}
            categories={categories}
            onSave={() => { setShowNewRule(false); loadRules() }}
            onCancel={() => setShowNewRule(false)}
          />
        )}

        {editingRule && (
          <RecurringRuleForm
            accounts={accounts}
            categories={categories}
            rule={editingRule}
            onSave={() => { setEditingRule(null); loadRules() }}
            onCancel={() => setEditingRule(null)}
          />
        )}

        <div className="settings-list">
          {rules.map(rule => {
            const account = accountMap.get(rule.account_id)
            const category = rule.category_id ? categoryMap.get(rule.category_id) : null
            const categoryDisplay = category ? getCategoryDisplayName(category, categoryMap) : null
            return (
              <div key={rule.id} className={`settings-list-item ${!rule.active ? 'archived' : ''}`}>
                <div className="settings-list-item-info">
                  <span className="settings-list-item-name">{rule.title}</span>
                  <span className="settings-list-item-meta">
                    {formatAud(rule.amount)} · {rule.frequency} · {account?.name ?? '?'}
                    {categoryDisplay && ` · ${categoryDisplay}`}
                  </span>
                  <span className="settings-list-item-meta recurring-next">
                    Next: {getNextDueDate(rule)}
                  </span>
                </div>
                <div className="settings-list-item-actions">
                  <button
                    className={`btn btn-small ${rule.active ? '' : 'btn-primary'}`}
                    onClick={() => handleToggleRule(rule)}
                  >
                    {rule.active ? 'Pause' : 'Resume'}
                  </button>
                  <button className="btn btn-small" onClick={() => setEditingRule(rule)}>Edit</button>
                  <button className="btn btn-small btn-danger" onClick={() => handleDeleteRule(rule.id)}>Delete</button>
                </div>
              </div>
            )
          })}
          {rules.length === 0 && !showNewRule && (
            <p className="settings-empty">No recurring rules. Add one to automate regular transactions.</p>
          )}
        </div>
      </section>
    </div>
  )
}
