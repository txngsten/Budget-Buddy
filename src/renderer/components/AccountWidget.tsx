import React, { useEffect, useState } from 'react'
import type { Account, Transaction } from '../../shared/types'
import { formatAud } from '../lib/format'
import { Period, getPeriodStart, getPeriodLabel } from '../lib/periods'
import BalanceSparkline from './BalanceSparkline'

interface Props {
  account?: Account
  accounts?: Account[]
  combined?: boolean
}

export default function AccountWidget({ account, accounts, combined }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [period, setPeriod] = useState<Period>('week')

  useEffect(() => {
    loadTransactions()
  }, [account?.id, combined, accounts])

  async function loadTransactions() {
    if (combined && accounts) {
      const activeIds = accounts.filter(a => !a.archived).map(a => a.id)
      const all = await window.api.transactions.list()
      setTransactions(all.filter(t => activeIds.includes(t.account_id)))
    } else if (account) {
      setTransactions(await window.api.transactions.list({ account_id: account.id }))
    }
  }

  const seedBalance = combined
    ? (accounts?.filter(a => !a.archived).reduce((s, a) => s + a.seed_balance, 0) ?? 0)
    : (account?.seed_balance ?? 0)

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)
  const totalSpend = transactions
    .filter(t => t.type === 'spend')
    .reduce((s, t) => s + t.amount, 0)
  const balance = seedBalance + totalIncome - totalSpend

  const periodStart = getPeriodStart(period)
  const now = new Date()

  const periodTxs = transactions.filter(t => new Date(t.occurred_at) >= periodStart)
  const periodIncome = periodTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const periodSpend = periodTxs.filter(t => t.type === 'spend').reduce((s, t) => s + t.amount, 0)
  const periodNet = periodIncome - periodSpend

  const prevPeriodStart = new Date(periodStart)
  prevPeriodStart.setDate(prevPeriodStart.getDate() - Math.ceil((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)))
  const prevPeriodTxs = transactions.filter(t => {
    const d = new Date(t.occurred_at)
    return d >= prevPeriodStart && d < periodStart
  })
  const prevNet = prevPeriodTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    - prevPeriodTxs.filter(t => t.type === 'spend').reduce((s, t) => s + t.amount, 0)

  let pctChange: string | null = null
  if (prevNet !== 0) {
    const pct = ((periodNet - prevNet) / Math.abs(prevNet)) * 100
    pctChange = `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`
  }

  const name = combined ? 'All Accounts' : account!.name
  const typeBadge = combined ? null : account!.type

  return (
    <div className="widget">
      <div className="widget-header">
        <div className="widget-title-row">
          <span className="widget-name">{name}</span>
          {typeBadge && <span className="account-type-badge">{typeBadge}</span>}
        </div>
        <span className={`widget-balance ${balance >= 0 ? 'positive' : 'negative'}`}>
          {formatAud(balance)}
        </span>
      </div>

      <div className="widget-period-selector">
        {(['week', 'fortnight', 'month'] as Period[]).map(p => (
          <button
            key={p}
            className={`period-btn ${period === p ? 'active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {getPeriodLabel(p)}
          </button>
        ))}
      </div>

      <div className="widget-stats">
        <div className="widget-stat">
          <span className="widget-stat-label">Spent</span>
          <span className="widget-stat-value negative">{formatAud(periodSpend)}</span>
        </div>
        <div className="widget-stat">
          <span className="widget-stat-label">Income</span>
          <span className="widget-stat-value positive">{formatAud(periodIncome)}</span>
        </div>
        <div className="widget-stat">
          <span className="widget-stat-label">Net</span>
          <span className={`widget-stat-value ${periodNet >= 0 ? 'positive' : 'negative'}`}>
            {periodNet >= 0 ? '+' : ''}{formatAud(periodNet)}
            {pctChange && <span className="widget-pct">{pctChange}</span>}
          </span>
        </div>
      </div>

      <BalanceSparkline
        transactions={transactions}
        seedBalance={seedBalance}
        periodStart={periodStart}
        periodEnd={now}
      />
    </div>
  )
}
