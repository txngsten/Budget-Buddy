import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type { Account, Category, Transaction } from '../../shared/types'
import { formatAud } from '../lib/format'
import { getCategoryDisplayName } from '../lib/categories'
import {
  buildTopLevelSlices, buildDrillSlices, keyForTransaction, type Slice,
} from '../lib/categoryBreakdown'
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
        <CategorySpendColumnChart transactions={chartTransactions} categories={categories} categoryMap={categoryMap} />
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
                  <div className="transaction-info-main">
                    <span className="transaction-date">
                      {new Date(tx.occurred_at).toLocaleDateString('en-AU', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </span>
                    <span className="transaction-title">{tx.title}</span>
                    {cat && (
                      <span className="transaction-category" style={{ backgroundColor: cat.colour + '22', color: cat.colour }}>
                        {getCategoryDisplayName(cat, categoryMap)}
                      </span>
                    )}
                  </div>
                  {tx.description && (
                    <p className="transaction-description">{tx.description}</p>
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

type BucketMode = 'weekly' | 'fortnightly' | 'monthly'

function CategorySpendColumnChart({
  transactions,
  categories,
  categoryMap,
}: {
  transactions: Transaction[]
  categories: Category[]
  categoryMap: Map<number, Category>
}) {
  const [bucketMode, setBucketMode] = useState<BucketMode>('weekly')
  const [drillId, setDrillId] = useState<number | null>(null)

  const spendTxs = transactions.filter(t => t.type === 'spend')

  // Series match the pie charts: top-level categories, or the subcategories of the
  // one being drilled into.
  const drillCategory = drillId !== null ? categoryMap.get(drillId) ?? null : null
  const topLevelSlices = buildTopLevelSlices(spendTxs, categoryMap)
  const drillSlices = drillCategory ? buildDrillSlices(spendTxs, categoryMap, drillCategory) : []
  const showingDrill = drillCategory !== null && drillSlices.length > 0
  const slices = showingDrill ? drillSlices : topLevelSlices

  if (spendTxs.length === 0) return null

  const bucketMap = new Map<string, { label: string; values: Record<string, number> }>()
  const categoryKeys = new Map<string, { name: string; colour: string }>()

  for (const slice of slices) {
    categoryKeys.set(`cat_${slice.key}`, { name: slice.name, colour: slice.colour })
  }

  for (const tx of spendTxs) {
    const sliceKey = keyForTransaction(tx, categoryMap, showingDrill ? drillCategory : null)
    if (sliceKey === null) continue
    const key = `cat_${sliceKey}`
    if (!categoryKeys.has(key)) continue

    const { label, sortKey } = getBucket(new Date(tx.occurred_at), bucketMode)
    const bucket = bucketMap.get(sortKey) ?? { label, values: {} }
    bucket.values[key] = (bucket.values[key] ?? 0) + tx.amount
    bucketMap.set(sortKey, bucket)
  }

  const sortedBuckets = Array.from(bucketMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))

  const data = sortedBuckets.map(([, bucket]) => ({ bucket: bucket.label, ...bucket.values }))

  const modeLabels: Record<BucketMode, string> = {
    weekly: 'Weekly',
    fortnightly: 'Fortnightly',
    monthly: 'Monthly',
  }

  function drillInto(slice: Slice) {
    if (showingDrill) return
    if (slice.topLevelId === null || slice.breakdownCount < 2) return
    setDrillId(slice.topLevelId)
  }

  return (
    <div className="chart-section">
      <div className="chart-title-row">
        <h4 className="chart-title">
          {modeLabels[bucketMode]} Spend by Category
          {showingDrill ? ` — ${drillCategory!.name}` : ''}
        </h4>
        <div className="chart-title-controls">
          {showingDrill && (
            <button className="btn btn-small" onClick={() => setDrillId(null)}>
              ← Back
            </button>
          )}
          <div className="period-btn-group">
            {(['weekly', 'fortnightly', 'monthly'] as BucketMode[]).map(m => (
              <button
                key={m}
                className={`period-btn ${bucketMode === m ? 'active' : ''}`}
                onClick={() => setBucketMode(m)}
              >
                {modeLabels[m]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
          />
          <YAxis
            tickFormatter={(v: number) => formatAud(v)}
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            width={70}
          />
          <Tooltip
            formatter={(value, name) => {
              const catInfo = categoryKeys.get(String(name))
              return [formatAud(value as number), catInfo?.name ?? name]
            }}
            contentStyle={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              fontSize: 13,
            }}
          />
          {slices.map(slice => {
            const drillable = !showingDrill && slice.topLevelId !== null && slice.breakdownCount >= 2
            return (
              <Bar
                key={`cat_${slice.key}`}
                dataKey={`cat_${slice.key}`}
                fill={slice.colour}
                name={`cat_${slice.key}`}
                radius={[3, 3, 0, 0]}
                cursor={drillable ? 'pointer' : 'default'}
                onClick={() => drillInto(slice)}
              />
            )
          })}
        </BarChart>
      </ResponsiveContainer>
      <div className="category-legend">
        {slices.map(slice => {
          const drillable = !showingDrill && slice.topLevelId !== null && slice.breakdownCount >= 2
          return (
            <button
              key={slice.key}
              type="button"
              className={`category-legend-item ${drillable ? 'drillable' : ''}`}
              onClick={() => drillInto(slice)}
              disabled={!drillable}
              title={drillable ? `View subcategories of ${slice.name}` : slice.name}
            >
              <span className="category-legend-dot" style={{ backgroundColor: slice.colour }} />
              {slice.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Bucket a date, returning its display label plus a chronologically sortable key. */
function getBucket(date: Date, mode: BucketMode): { label: string; sortKey: string } {
  if (mode === 'monthly') {
    const start = new Date(date.getFullYear(), date.getMonth(), 1)
    return {
      label: date.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
      sortKey: isoDay(start),
    }
  }

  const monday = new Date(date)
  const day = monday.getDay()
  monday.setDate(monday.getDate() - ((day + 6) % 7))
  monday.setHours(0, 0, 0, 0)

  if (mode === 'fortnightly') {
    const yearStart = new Date(monday.getFullYear(), 0, 1)
    const daysSinceStart = Math.floor((monday.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24))
    const fortnight = Math.floor(daysSinceStart / 14)
    const fnStart = new Date(yearStart)
    fnStart.setDate(fnStart.getDate() + fortnight * 14)
    return {
      label: fnStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
      sortKey: isoDay(fnStart),
    }
  }

  return {
    label: monday.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
    sortKey: isoDay(monday),
  }
}

function isoDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
