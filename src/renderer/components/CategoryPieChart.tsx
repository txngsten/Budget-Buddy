import React, { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { Transaction, Category } from '../../shared/types'
import { formatAud } from '../lib/format'
import { buildTopLevelSlices, buildDrillSlices, type Slice } from '../lib/categoryBreakdown'

interface Props {
  transactions: Transaction[]
  categories: Category[]
  type: 'income' | 'spend'
  title: string
}

export default function CategoryPieChart({ transactions, categories, type, title }: Props) {
  const [drillId, setDrillId] = useState<number | null>(null)

  const filtered = transactions.filter(t => t.type === type)
  const categoryMap = new Map(categories.map(c => [c.id, c]))

  const topLevelSlices = buildTopLevelSlices(filtered, categoryMap)
  const drillCategory = drillId !== null ? categoryMap.get(drillId) ?? null : null
  const drillSlices = drillCategory ? buildDrillSlices(filtered, categoryMap, drillCategory) : []

  const showingDrill = drillCategory !== null && drillSlices.length > 0
  const data = showingDrill ? drillSlices : topLevelSlices

  if (topLevelSlices.length === 0) {
    return (
      <div className="chart-section">
        <h4 className="chart-title">{title}</h4>
        <p className="settings-empty">No {type} data for this period.</p>
      </div>
    )
  }

  const total = data.reduce((sum, s) => sum + s.value, 0)

  function handleSliceClick(slice: Slice) {
    if (showingDrill) return
    if (slice.topLevelId === null || slice.breakdownCount < 2) return
    setDrillId(slice.topLevelId)
  }

  return (
    <div className="chart-section">
      <div className="chart-title-row">
        <h4 className="chart-title">
          {showingDrill ? `${title} — ${drillCategory!.name}` : title}
        </h4>
        {showingDrill && (
          <button className="btn btn-small" onClick={() => setDrillId(null)}>
            ← Back
          </button>
        )}
      </div>

      <div className="pie-with-legend">
        <div className="pie-with-legend-chart">
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
                isAnimationActive={false}
                onClick={(_, index) => handleSliceClick(data[index])}
              >
                {data.map(slice => (
                  <Cell
                    key={slice.key}
                    fill={slice.colour}
                    cursor={!showingDrill && slice.breakdownCount >= 2 ? 'pointer' : 'default'}
                  />
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
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="pie-legend">
          {data.map(slice => {
            const drillable = !showingDrill && slice.breakdownCount >= 2
            return (
              <li key={slice.key}>
                <button
                  type="button"
                  className={`pie-legend-item ${drillable ? 'drillable' : ''}`}
                  onClick={() => handleSliceClick(slice)}
                  disabled={!drillable}
                  title={drillable ? `View subcategories of ${slice.name}` : slice.name}
                >
                  <span className="pie-legend-dot" style={{ backgroundColor: slice.colour }} />
                  <span className="pie-legend-name">{slice.name}</span>
                  <span className="pie-legend-value">{formatAud(slice.value)}</span>
                  <span className="pie-legend-pct">
                    {total > 0 ? Math.round((slice.value / total) * 100) : 0}%
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
