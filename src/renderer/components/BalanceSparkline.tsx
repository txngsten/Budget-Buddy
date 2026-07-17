import React from 'react'
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'
import type { Transaction } from '../../shared/types'

interface Props {
  transactions: Transaction[]
  seedBalance: number
  periodStart: Date
  periodEnd: Date
}

export default function BalanceSparkline({ transactions, seedBalance, periodStart, periodEnd }: Props) {
  const days = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return null

  const prePeriodTxs = transactions.filter(t => new Date(t.occurred_at) < periodStart)
  let startingBalance = seedBalance
  for (const t of prePeriodTxs) {
    startingBalance += t.type === 'income' ? t.amount : -t.amount
  }

  const periodTxs = transactions
    .filter(t => {
      const d = new Date(t.occurred_at)
      return d >= periodStart && d <= periodEnd
    })
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))

  const data: { day: number; balance: number }[] = []
  let balance = startingBalance

  for (let i = 0; i <= days; i++) {
    const dayStart = new Date(periodStart)
    dayStart.setDate(dayStart.getDate() + i)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const dayTxs = periodTxs.filter(t => {
      const d = new Date(t.occurred_at)
      return d >= dayStart && d < dayEnd
    })

    for (const t of dayTxs) {
      balance += t.type === 'income' ? t.amount : -t.amount
    }

    data.push({ day: i, balance })
  }

  const net = data.length > 1 ? data[data.length - 1].balance - data[0].balance : 0
  const colour = net >= 0 ? '#30d158' : '#ff3b30'

  return (
    <div className="sparkline-container">
      <ResponsiveContainer width="100%" height={48}>
        <LineChart data={data}>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Line
            type="monotone"
            dataKey="balance"
            stroke={colour}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
