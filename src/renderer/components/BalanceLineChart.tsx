import React from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Transaction } from '../../shared/types'
import { formatAud } from '../lib/format'

interface Props {
  transactions: Transaction[]
  seedBalance: number
  start: string
  end: string
}

export default function BalanceLineChart({ transactions, seedBalance, start, end }: Props) {
  const startDate = new Date(start)
  startDate.setHours(0, 0, 0, 0)
  const endDate = new Date(end)
  endDate.setHours(23, 59, 59, 999)

  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return null

  const sorted = [...transactions].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))

  const prePeriodTxs = sorted.filter(t => new Date(t.occurred_at) < startDate)
  let runningBalance = seedBalance
  for (const t of prePeriodTxs) {
    runningBalance += t.type === 'income' ? t.amount : -t.amount
  }

  const periodTxs = sorted.filter(t => {
    const d = new Date(t.occurred_at)
    return d >= startDate && d <= endDate
  })

  const data: { date: string; balance: number }[] = []

  for (let i = 0; i <= days; i++) {
    const dayStart = new Date(startDate)
    dayStart.setDate(dayStart.getDate() + i)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const dayTxs = periodTxs.filter(t => {
      const d = new Date(t.occurred_at)
      return d >= dayStart && d < dayEnd
    })

    for (const t of dayTxs) {
      runningBalance += t.type === 'income' ? t.amount : -t.amount
    }

    data.push({
      date: dayStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
      balance: runningBalance,
    })
  }

  const showEveryNth = Math.max(1, Math.floor(data.length / 6))

  return (
    <div className="chart-section">
      <h4 className="chart-title">Balance Over Time</h4>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            interval={showEveryNth - 1}
          />
          <YAxis
            tickFormatter={(v: number) => formatAud(v)}
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            width={80}
          />
          <Tooltip
            formatter={(value) => [formatAud(value as number), 'Balance']}
            contentStyle={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              fontSize: 13,
            }}
          />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
