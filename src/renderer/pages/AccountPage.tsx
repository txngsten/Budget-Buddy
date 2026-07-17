import React, { useEffect, useState } from 'react'
import type { Account, Category, Transaction } from '../../shared/types'
import { formatAud } from '../lib/format'
import AddItemModal from '../components/AddItemModal'
import ConfirmDialog from '../components/ConfirmDialog'
import DateRangeSlider from '../components/DateRangeSlider'
import CategoryPieChart from '../components/CategoryPieChart'
import BalanceLineChart from '../components/BalanceLineChart'

interface Props {
  accountId: number
  allAccounts: Account[]
  categories: Category[]
  onAccountsChanged: () => void
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default function AccountPage({ accountId, allAccounts, categories, onAccountsChanged }: Props) {
  const [account, setAccount] = useState<Account | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [showAddItem, setShowAddItem] = useState(false)
  const [deletingTxId, setDeletingTxId] = useState<number | null>(null)

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const [chartStart, setChartStart] = useState(toDateStr(thirtyDaysAgo))
  const [chartEnd, setChartEnd] = useState(toDateStr(new Date()))

  useEffect(() => {
    loadData()
  }, [accountId])

  async function loadData() {
    const accounts = await window.api.accounts.list()
    setAccount(accounts.find(a => a.id === accountId) ?? null)
    const txs = await window.api.transactions.list({ account_id: accountId })
    setTransactions(txs)
  }

  if (!account) return null

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
  const totalSpend = transactions
    .filter(t => t.type === 'spend')
    .reduce((sum, t) => sum + t.amount, 0)
  const balance = account.seed_balance + totalIncome - totalSpend
  const net = totalIncome - totalSpend

  const categoryMap = new Map(categories.map(c => [c.id, c]))

  const chartStartDate = new Date(chartStart)
  chartStartDate.setHours(0, 0, 0, 0)
  const chartEndDate = new Date(chartEnd)
  chartEndDate.setHours(23, 59, 59, 999)

  const chartTransactions = transactions.filter(t => {
    const d = new Date(t.occurred_at)
    return d >= chartStartDate && d <= chartEndDate
  })

  async function handleDeleteTx() {
    if (deletingTxId === null) return
    await window.api.transactions.delete(deletingTxId)
    setDeletingTxId(null)
    loadData()
  }

  return (
    <div className="account-page">
      <div className="account-header">
        <h2>{account.name}</h2>
        <span className="account-type-badge">{account.type}</span>
      </div>

      <div className="totals-strip">
        <div className="totals-item">
          <span className="totals-label">Balance</span>
          <span className={`totals-value ${balance >= 0 ? 'positive' : 'negative'}`}>
            {formatAud(balance)}
          </span>
        </div>
        <div className="totals-item">
          <span className="totals-label">Spend</span>
          <span className="totals-value negative">{formatAud(totalSpend)}</span>
        </div>
        <div className="totals-item">
          <span className="totals-label">Income</span>
          <span className="totals-value positive">{formatAud(totalIncome)}</span>
        </div>
        <div className="totals-item">
          <span className="totals-label">Net</span>
          <span className={`totals-value ${net >= 0 ? 'positive' : 'negative'}`}>
            {net >= 0 ? '+' : ''}{formatAud(net)}
          </span>
        </div>
      </div>

      <section className="charts-section">
        <DateRangeSlider
          start={chartStart}
          end={chartEnd}
          onChange={(s, e) => { setChartStart(s); setChartEnd(e) }}
        />
        <div className="charts-row">
          <CategoryPieChart
            transactions={chartTransactions}
            categories={categories}
            type="income"
            title="Income by Category"
          />
          <CategoryPieChart
            transactions={chartTransactions}
            categories={categories}
            type="spend"
            title="Spend by Category"
          />
        </div>
        <BalanceLineChart
          transactions={transactions}
          seedBalance={account.seed_balance}
          start={chartStart}
          end={chartEnd}
        />
      </section>

      <div className="account-actions-bar">
        <button className="btn btn-primary" onClick={() => setShowAddItem(true)}>
          Add Item
        </button>
      </div>

      <div className="transactions-list">
        {transactions.length === 0 ? (
          <p className="settings-empty">No transactions yet. Add your first item above.</p>
        ) : (
          transactions.map(tx => {
            const cat = tx.category_id ? categoryMap.get(tx.category_id) : null
            return (
              <div key={tx.id} className="transaction-row">
                <div className="transaction-info">
                  <span className="transaction-date">
                    {new Date(tx.occurred_at).toLocaleDateString('en-AU', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </span>
                  <span className="transaction-title">{tx.title}</span>
                  {cat && (
                    <span className="transaction-category" style={{ backgroundColor: cat.colour + '22', color: cat.colour }}>
                      {cat.name}
                    </span>
                  )}
                </div>
                <div className="transaction-right">
                  <span className={`transaction-amount ${tx.type}`}>
                    {tx.type === 'spend' ? '-' : '+'}{formatAud(tx.amount)}
                  </span>
                  <div className="transaction-actions">
                    <button className="btn btn-small" onClick={() => setEditingTx(tx)}>Edit</button>
                    <button className="btn btn-small btn-danger" onClick={() => setDeletingTxId(tx.id)}>Del</button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {(showAddItem || editingTx) && (
        <AddItemModal
          accounts={allAccounts}
          categories={categories}
          presetAccountId={accountId}
          editTransaction={editingTx ?? undefined}
          onSave={() => {
            setShowAddItem(false)
            setEditingTx(null)
            loadData()
            onAccountsChanged()
          }}
          onClose={() => { setShowAddItem(false); setEditingTx(null) }}
        />
      )}

      {deletingTxId !== null && (
        <ConfirmDialog
          message="Are you sure you want to delete this transaction? This cannot be undone."
          onConfirm={handleDeleteTx}
          onCancel={() => setDeletingTxId(null)}
        />
      )}
    </div>
  )
}
