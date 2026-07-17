import { getDb } from './db'
import type { RecurringRule } from '../shared/types'

export function runRecurringEngine(): void {
  const db = getDb()
  const rules = db.prepare(
    'SELECT * FROM recurring_rules WHERE active = 1'
  ).all() as RecurringRule[]

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  for (const rule of rules) {
    const occurrences = computeDueOccurrences(rule, todayStr)
    if (occurrences.length === 0) continue

    const insertTx = db.prepare(
      `INSERT INTO transactions (account_id, title, type, category_id, amount, occurred_at, recurring_id, created_at, updated_at)
       VALUES (@account_id, @title, @type, @category_id, @amount, @occurred_at, @recurring_id, @created_at, @updated_at)`
    )

    const updateLastPosted = db.prepare(
      'UPDATE recurring_rules SET last_posted = ? WHERE id = ?'
    )

    db.transaction(() => {
      let lastDate = rule.last_posted
      for (const date of occurrences) {
        const now = new Date().toISOString()
        insertTx.run({
          account_id: rule.account_id,
          title: rule.title,
          type: rule.type,
          category_id: rule.category_id,
          amount: rule.amount,
          occurred_at: date + 'T00:00:00.000Z',
          recurring_id: rule.id,
          created_at: now,
          updated_at: now,
        })
        lastDate = date
      }
      if (lastDate) {
        updateLastPosted.run(lastDate, rule.id)
      }
    })()
  }
}

function computeDueOccurrences(rule: RecurringRule, todayStr: string): string[] {
  const occurrences: string[] = []
  const startDate = parseDate(rule.start_date)
  const afterDate = rule.last_posted ? parseDate(rule.last_posted) : null
  const endDate = rule.end_date ? parseDate(rule.end_date) : null
  const today = parseDate(todayStr)

  let current = afterDate ? getNextOccurrence(rule, afterDate) : startDate

  while (current && current <= today) {
    if (endDate && current > endDate) break

    const dateStr = formatDate(current)
    occurrences.push(dateStr)

    current = getNextOccurrence(rule, current)
  }

  return occurrences
}

function getNextOccurrence(rule: RecurringRule, fromDate: Date): Date | null {
  const next = new Date(fromDate)

  switch (rule.frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7)
      break
    case 'fortnightly':
      next.setDate(next.getDate() + 14)
      break
    case 'monthly':
      return getNextMonthlyOccurrence(rule, fromDate)
    case 'custom':
      if (!rule.interval_days) return null
      next.setDate(next.getDate() + rule.interval_days)
      break
  }

  return next
}

function getNextMonthlyOccurrence(rule: RecurringRule, fromDate: Date): Date {
  const startDay = parseDate(rule.start_date).getDate()
  const next = new Date(fromDate)
  next.setMonth(next.getMonth() + 1)

  const maxDay = getDaysInMonth(next.getFullYear(), next.getMonth())
  next.setDate(Math.min(startDay, maxDay))

  return next
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function parseDate(str: string): Date {
  const d = new Date(str.slice(0, 10) + 'T00:00:00')
  return d
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
