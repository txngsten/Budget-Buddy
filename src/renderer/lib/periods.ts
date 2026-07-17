export type Period = 'week' | 'fortnight' | 'month'

export function getPeriodDays(period: Period): number {
  switch (period) {
    case 'week': return 7
    case 'fortnight': return 14
    case 'month': return 30
  }
}

export function getPeriodStart(period: Period): Date {
  const now = new Date()
  now.setDate(now.getDate() - getPeriodDays(period))
  now.setHours(0, 0, 0, 0)
  return now
}

export function getPeriodLabel(period: Period): string {
  switch (period) {
    case 'week': return 'Week'
    case 'fortnight': return 'Fortnight'
    case 'month': return 'Month'
  }
}
