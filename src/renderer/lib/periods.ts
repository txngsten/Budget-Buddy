export type Period = 'week' | 'fortnight' | 'month' | '6month' | 'year' | 'all'

export function getPeriodDays(period: Period): number {
  switch (period) {
    case 'week': return 7
    case 'fortnight': return 14
    case 'month': return 30
    case '6month': return 182
    case 'year': return 365
    case 'all': return -1
  }
}

export function getPeriodStart(period: Period, allTimeAnchor?: Date): Date {
  if (period === 'all' && allTimeAnchor) {
    const d = new Date(allTimeAnchor)
    d.setHours(0, 0, 0, 0)
    return d
  }
  const now = new Date()
  const days = getPeriodDays(period)
  if (days === -1) {
    return new Date(2000, 0, 1)
  }
  now.setDate(now.getDate() - days)
  now.setHours(0, 0, 0, 0)
  return now
}

export function getPeriodLabel(period: Period): string {
  switch (period) {
    case 'week': return 'Week'
    case 'fortnight': return 'Fortnight'
    case 'month': return 'Month'
    case '6month': return '6 Month'
    case 'year': return 'Year'
    case 'all': return 'All Time'
  }
}
