import React, { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import type { Account, Category, Transaction } from '../../shared/types'
import { formatAud } from '../lib/format'
import { getCategoryDisplayName } from '../lib/categories'

interface Props {
  accounts: Account[]
  categories: Category[]
}

type Preset = 30 | 60 | 90 | 'custom'

const ACCOUNT_COLOURS = [
  '#0a84ff', '#30d158', '#ff9f0a', '#bf5af2', '#ff375f', '#64d2ff', '#ffd60a',
]

export default function ProjectionsPage({ accounts, categories }: Props) {
  const [lookbackPreset, setLookbackPreset] = useState<Preset>(30)
  const [lookbackCustom, setLookbackCustom] = useState('30')
  const [horizonPreset, setHorizonPreset] = useState<Preset>(30)
  const [horizonCustom, setHorizonCustom] = useState('30')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set())

  const lookback = lookbackPreset === 'custom' ? (parseInt(lookbackCustom) || 30) : lookbackPreset
  const horizon = horizonPreset === 'custom' ? (parseInt(horizonCustom) || 30) : horizonPreset

  const activeAccounts = accounts.filter(a => !a.archived)

  useEffect(() => {
    loadTransactions()
  }, [])

  async function loadTransactions() {
    const all = await window.api.transactions.list()
    setTransactions(all)
  }

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const lookbackStart = new Date(now)
  lookbackStart.setDate(lookbackStart.getDate() - lookback)

  const lookbackTxs = transactions.filter(t => {
    const d = new Date(t.occurred_at)
    return d >= lookbackStart && d <= now
  })

  const hasData = lookbackTxs.length > 0

  const sortedTxs = [...transactions].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))

  function computeBalance(account: Account): number {
    const acctTxs = transactions.filter(t => t.account_id === account.id)
    let balance = account.seed_balance
    for (const t of acctTxs) {
      balance += t.type === 'income' ? t.amount : -t.amount
    }
    return balance
  }

  function computeBalanceAtDate(accountId: number, seedBalance: number, upTo: Date): number {
    let balance = seedBalance
    for (const t of sortedTxs) {
      if (t.account_id !== accountId) continue
      if (new Date(t.occurred_at) > upTo) break
      balance += t.type === 'income' ? t.amount : -t.amount
    }
    return balance
  }

  function computeDailyRates(accountId?: number) {
    const filtered = accountId
      ? lookbackTxs.filter(t => t.account_id === accountId)
      : lookbackTxs.filter(t => activeAccounts.some(a => a.id === t.account_id))

    const income = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const spend = filtered.filter(t => t.type === 'spend').reduce((s, t) => s + t.amount, 0)

    return {
      dailyIncome: income / lookback,
      dailySpend: spend / lookback,
      dailyNet: (income - spend) / lookback,
    }
  }

  // --- Build combined chart data: historical + projected ---
  const chartData: Record<string, number | string | undefined>[] = []
  const todayLabel = now.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

  // Historical portion (lookback days up to and including today)
  for (let i = 0; i <= lookback; i++) {
    const day = new Date(lookbackStart)
    day.setDate(day.getDate() + i)
    const dayEnd = new Date(day)
    dayEnd.setHours(23, 59, 59, 999)
    const label = day.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

    const point: Record<string, number | string | undefined> = { date: label }

    let combinedBal = 0
    for (const a of activeAccounts) {
      const bal = computeBalanceAtDate(a.id, a.seed_balance, dayEnd)
      point[a.name + '_actual'] = Math.round(bal)
      combinedBal += bal
    }
    point['Combined_actual'] = Math.round(combinedBal)

    // On today, also set the projected keys so the lines connect
    if (i === lookback) {
      point['Combined_projected'] = Math.round(combinedBal)
      for (const a of activeAccounts) {
        point[a.name + '_projected'] = point[a.name + '_actual']
      }
    }

    chartData.push(point)
  }

  // Projected portion (day 1 to horizon, after today)
  const accountRates = new Map<number, { dailyNet: number }>()
  for (const a of activeAccounts) {
    accountRates.set(a.id, computeDailyRates(a.id))
  }
  const combinedRates = computeDailyRates()

  const projectedBalances = new Map<number, number>()
  for (const a of activeAccounts) {
    projectedBalances.set(a.id, computeBalance(a))
  }
  let projectedCombined = activeAccounts.reduce((s, a) => s + computeBalance(a), 0)

  for (let i = 1; i <= horizon; i++) {
    const day = new Date(now)
    day.setDate(day.getDate() + i)
    const label = day.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

    const point: Record<string, number | string | undefined> = { date: label }

    projectedCombined += combinedRates.dailyNet
    point['Combined_projected'] = Math.round(projectedCombined)

    for (const a of activeAccounts) {
      const bal = projectedBalances.get(a.id)! + accountRates.get(a.id)!.dailyNet
      projectedBalances.set(a.id, bal)
      point[a.name + '_projected'] = Math.round(bal)
    }

    chartData.push(point)
  }

  const xInterval = Math.max(0, Math.floor(chartData.length / 8) - 1)

  // Category breakdown for the horizon
  const categorySpend = new Map<string, { name: string; value: number; colour: string }>()
  const categoryMap = new Map(categories.map(c => [c.id, c]))

  for (const tx of lookbackTxs.filter(t => t.type === 'spend' && activeAccounts.some(a => a.id === t.account_id))) {
    const cat = tx.category_id ? categoryMap.get(tx.category_id) : null
    const key = cat ? String(cat.id) : 'uncategorised'
    const entry = categorySpend.get(key) ?? {
      name: cat ? getCategoryDisplayName(cat, categoryMap) : 'Uncategorised',
      value: 0,
      colour: cat?.colour ?? '#8e8e93',
    }
    entry.value += tx.amount
    categorySpend.set(key, entry)
  }

  const projectedCategorySpend = Array.from(categorySpend.values())
    .map(c => ({ ...c, value: Math.round((c.value / lookback) * horizon) }))
    .sort((a, b) => b.value - a.value)

  // Summary cards
  const projectedCombinedNet = Math.round(combinedRates.dailyNet * horizon)
  const biggestCategory = projectedCategorySpend[0] ?? null
  const endBalances = activeAccounts.map(a => ({
    name: a.name,
    balance: Math.round(computeBalance(a) + (accountRates.get(a.id)?.dailyNet ?? 0) * horizon),
  }))
  const negativeAccounts = endBalances.filter(a => a.balance < 0)

  function toggleLine(key: string) {
    setHiddenLines(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const allLineNames = ['Combined', ...activeAccounts.map(a => a.name)]

  return (
    <div className="projections-page">
      <h2>Projections</h2>

      <div className="projections-controls">
        <div className="projection-control">
          <span className="projection-control-label">Lookback</span>
          <div className="period-btn-group">
            {([30, 60, 90] as const).map(v => (
              <button
                key={v}
                className={`period-btn ${lookbackPreset === v ? 'active' : ''}`}
                onClick={() => setLookbackPreset(v)}
              >
                {v}d
              </button>
            ))}
            <button
              className={`period-btn ${lookbackPreset === 'custom' ? 'active' : ''}`}
              onClick={() => setLookbackPreset('custom')}
            >
              Custom
            </button>
          </div>
          {lookbackPreset === 'custom' && (
            <input
              className="form-input form-input-short"
              type="number"
              min="1"
              value={lookbackCustom}
              onChange={e => setLookbackCustom(e.target.value)}
              placeholder="days"
            />
          )}
        </div>

        <div className="projection-control">
          <span className="projection-control-label">Horizon</span>
          <div className="period-btn-group">
            {([7, 30, 90] as const).map(v => (
              <button
                key={v}
                className={`period-btn ${horizonPreset === v ? 'active' : ''}`}
                onClick={() => setHorizonPreset(v as Preset)}
              >
                {v}d
              </button>
            ))}
            <button
              className={`period-btn ${horizonPreset === 'custom' ? 'active' : ''}`}
              onClick={() => setHorizonPreset('custom')}
            >
              Custom
            </button>
          </div>
          {horizonPreset === 'custom' && (
            <input
              className="form-input form-input-short"
              type="number"
              min="1"
              value={horizonCustom}
              onChange={e => setHorizonCustom(e.target.value)}
              placeholder="days"
            />
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="empty-state">
          <h3>Not enough data</h3>
          <p>Add more transaction history so projections can be computed from your spending patterns.</p>
        </div>
      ) : (
        <>
          <div className="projections-summary-cards">
            <div className="summary-card">
              <span className="summary-card-label">Projected Net ({horizon}d)</span>
              <span className={`summary-card-value ${projectedCombinedNet >= 0 ? 'positive' : 'negative'}`}>
                {projectedCombinedNet >= 0 ? '+' : ''}{formatAud(projectedCombinedNet)}
              </span>
            </div>
            {biggestCategory && (
              <div className="summary-card">
                <span className="summary-card-label">Biggest Spend Category</span>
                <span className="summary-card-value" style={{ color: biggestCategory.colour }}>
                  {biggestCategory.name} ({formatAud(biggestCategory.value)})
                </span>
              </div>
            )}
            {negativeAccounts.length > 0 && (
              <div className="summary-card summary-card-warning">
                <span className="summary-card-label">Projected Negative</span>
                <span className="summary-card-value negative">
                  {negativeAccounts.map(a => a.name).join(', ')}
                </span>
              </div>
            )}
          </div>

          <section className="chart-section">
            <h4 className="chart-title">Balance — Actual &amp; Projected</h4>
            <div className="projection-legend">
              {allLineNames.map((name, i) => (
                <button
                  key={name}
                  className={`projection-legend-item ${hiddenLines.has(name) ? 'hidden' : ''}`}
                  onClick={() => toggleLine(name)}
                >
                  <span
                    className="projection-legend-dot"
                    style={{ backgroundColor: ACCOUNT_COLOURS[i % ACCOUNT_COLOURS.length] }}
                  />
                  {name}
                </button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  interval={xInterval}
                />
                <YAxis
                  tickFormatter={(v: number) => formatAud(v)}
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  width={80}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const clean = String(name ?? '').replace(/_actual$|_projected$/, '')
                    return [formatAud(value as number), clean]
                  }}
                  contentStyle={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                />
                <ReferenceLine
                  x={todayLabel}
                  stroke="var(--text-secondary)"
                  strokeDasharray="4 4"
                  label={{ value: 'Today', position: 'top', fontSize: 11, fill: 'var(--text-secondary)' }}
                />

                {/* Actual lines (solid) */}
                {allLineNames.map((name, i) => (
                  !hiddenLines.has(name) && (
                    <Line
                      key={name + '_actual'}
                      type="monotone"
                      dataKey={name + '_actual'}
                      stroke={ACCOUNT_COLOURS[i % ACCOUNT_COLOURS.length]}
                      strokeWidth={name === 'Combined' ? 2 : 1.5}
                      dot={false}
                      connectNulls={false}
                    />
                  )
                ))}

                {/* Projected lines (dashed) */}
                {allLineNames.map((name, i) => (
                  !hiddenLines.has(name) && (
                    <Line
                      key={name + '_projected'}
                      type="monotone"
                      dataKey={name + '_projected'}
                      stroke={ACCOUNT_COLOURS[i % ACCOUNT_COLOURS.length]}
                      strokeWidth={name === 'Combined' ? 2 : 1.5}
                      strokeDasharray="6 3"
                      dot={false}
                      connectNulls={false}
                    />
                  )
                ))}
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section className="chart-section">
            <h4 className="chart-title">Projected Spend by Category ({horizon}d)</h4>
            {projectedCategorySpend.length === 0 ? (
              <p className="settings-empty">No spend data in the lookback period.</p>
            ) : (
              <div className="category-bar-chart">
                {projectedCategorySpend.map(c => {
                  const maxVal = projectedCategorySpend[0].value
                  const pct = maxVal > 0 ? (c.value / maxVal) * 100 : 0
                  return (
                    <div key={c.name} className="category-bar-row">
                      <span className="category-bar-label">{c.name}</span>
                      <div className="category-bar-track">
                        <div
                          className="category-bar-fill"
                          style={{ width: `${pct}%`, backgroundColor: c.colour }}
                        />
                      </div>
                      <span className="category-bar-value">{formatAud(c.value)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="chart-section">
            <h4 className="chart-title">End Balances ({horizon}d)</h4>
            <div className="end-balances-grid">
              {endBalances.map(a => (
                <div key={a.name} className="end-balance-card">
                  <span className="end-balance-name">{a.name}</span>
                  <span className={`end-balance-value ${a.balance >= 0 ? 'positive' : 'negative'}`}>
                    {formatAud(a.balance)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
