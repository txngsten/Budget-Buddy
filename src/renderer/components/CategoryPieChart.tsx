import React from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Transaction, Category } from '../../shared/types'
import { formatAud } from '../lib/format'

interface Props {
  transactions: Transaction[]
  categories: Category[]
  type: 'income' | 'spend'
  title: string
}

export default function CategoryPieChart({ transactions, categories, type, title }: Props) {
  const filtered = transactions.filter(t => t.type === type)
  const categoryMap = new Map(categories.map(c => [c.id, c]))

  const grouped = new Map<string, { name: string; value: number; colour: string }>()

  for (const tx of filtered) {
    const cat = tx.category_id ? categoryMap.get(tx.category_id) : null
    const key = cat ? String(cat.id) : 'uncategorised'
    const entry = grouped.get(key) ?? {
      name: cat?.name ?? 'Uncategorised',
      value: 0,
      colour: cat?.colour ?? '#8e8e93',
    }
    entry.value += tx.amount
    grouped.set(key, entry)
  }

  const data = Array.from(grouped.values()).sort((a, b) => b.value - a.value)

  if (data.length === 0) {
    return (
      <div className="chart-section">
        <h4 className="chart-title">{title}</h4>
        <p className="settings-empty">No {type} data for this period.</p>
      </div>
    )
  }

  return (
    <div className="chart-section">
      <h4 className="chart-title">{title}</h4>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={75}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.colour} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatAud(value as number)}
            contentStyle={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              fontSize: 13,
            }}
          />
          <Legend
            formatter={(value: string) => <span style={{ color: 'var(--text-primary)', fontSize: 12 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
