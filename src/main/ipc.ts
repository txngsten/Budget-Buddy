import { ipcMain } from 'electron'
import { getDb } from './db'
import type { Account, Category, Transaction, RecurringRule } from '../shared/types'

function now(): string {
  return new Date().toISOString()
}

export function registerIpcHandlers(): void {
  // --- Accounts ---
  ipcMain.handle('accounts:list', (): Account[] => {
    return getDb().prepare('SELECT * FROM accounts ORDER BY sort_order').all() as Account[]
  })

  ipcMain.handle('accounts:create', (_, data: Omit<Account, 'id' | 'created_at'>): Account => {
    const db = getDb()
    const result = db.prepare(
      `INSERT INTO accounts (name, type, seed_balance, sort_order, archived, created_at)
       VALUES (@name, @type, @seed_balance, @sort_order, @archived, @created_at)`
    ).run({ ...data, created_at: now() })
    return db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid) as Account
  })

  ipcMain.handle('accounts:update', (_, id: number, data: Partial<Omit<Account, 'id' | 'created_at'>>): Account => {
    const db = getDb()
    const fields = Object.keys(data)
      .map(k => `${k} = @${k}`)
      .join(', ')
    db.prepare(`UPDATE accounts SET ${fields} WHERE id = @id`).run({ ...data, id })
    return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account
  })

  ipcMain.handle('accounts:archive', (_, id: number): void => {
    getDb().prepare('UPDATE accounts SET archived = 1 WHERE id = ?').run(id)
  })

  ipcMain.handle('accounts:unarchive', (_, id: number): void => {
    getDb().prepare('UPDATE accounts SET archived = 0 WHERE id = ?').run(id)
  })

  // --- Categories ---
  ipcMain.handle('categories:list', (): Category[] => {
    return getDb().prepare(
      'SELECT * FROM categories ORDER BY COALESCE(parent_id, id), parent_id IS NOT NULL, name'
    ).all() as Category[]
  })

  ipcMain.handle('categories:create', (_, data: Omit<Category, 'id' | 'created_at'>): Category => {
    const db = getDb()

    if (data.parent_id != null) {
      const parent = db.prepare('SELECT * FROM categories WHERE id = ?').get(data.parent_id) as Category | undefined
      if (!parent) throw new Error('Parent category not found.')
      if (parent.parent_id != null) throw new Error('Cannot nest categories more than one level deep.')
    }

    const result = db.prepare(
      `INSERT INTO categories (name, colour, parent_id, archived, created_at)
       VALUES (@name, @colour, @parent_id, @archived, @created_at)`
    ).run({ ...data, parent_id: data.parent_id ?? null, created_at: now() })
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid) as Category
  })

  ipcMain.handle('categories:update', (_, id: number, data: Partial<Omit<Category, 'id' | 'created_at'>>): Category => {
    const db = getDb()

    if ('parent_id' in data && data.parent_id != null) {
      const hasChildren = db.prepare('SELECT COUNT(*) as cnt FROM categories WHERE parent_id = ?').get(id) as { cnt: number }
      if (hasChildren.cnt > 0) throw new Error('This category has subcategories and cannot become a subcategory itself.')

      const parent = db.prepare('SELECT * FROM categories WHERE id = ?').get(data.parent_id) as Category | undefined
      if (!parent) throw new Error('Parent category not found.')
      if (parent.parent_id != null) throw new Error('Cannot nest categories more than one level deep.')
    }

    const fields = Object.keys(data)
      .map(k => `${k} = @${k}`)
      .join(', ')
    db.prepare(`UPDATE categories SET ${fields} WHERE id = @id`).run({ ...data, id })
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category
  })

  ipcMain.handle('categories:archive', (_, id: number): void => {
    getDb().prepare('UPDATE categories SET archived = 1 WHERE id = ? OR parent_id = ?').run(id, id)
  })

  ipcMain.handle('categories:unarchive', (_, id: number): void => {
    const db = getDb()
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category | undefined
    if (!cat) return

    if (cat.parent_id != null) {
      db.prepare('UPDATE categories SET archived = 0 WHERE id = ? OR id = ?').run(id, cat.parent_id)
    } else {
      db.prepare('UPDATE categories SET archived = 0 WHERE id = ?').run(id)
    }
  })

  // --- Transactions ---
  ipcMain.handle('transactions:list', (_, filters?: { account_id?: number; start?: string; end?: string }): Transaction[] => {
    let query = 'SELECT * FROM transactions WHERE 1=1'
    const params: any = {}

    if (filters?.account_id) {
      query += ' AND account_id = @account_id'
      params.account_id = filters.account_id
    }
    if (filters?.start) {
      query += ' AND occurred_at >= @start'
      params.start = filters.start
    }
    if (filters?.end) {
      query += ' AND occurred_at <= @end'
      params.end = filters.end
    }

    query += ' ORDER BY occurred_at DESC'
    return getDb().prepare(query).all(params) as Transaction[]
  })

  ipcMain.handle('transactions:create', (_, data: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Transaction => {
    const db = getDb()
    const timestamp = now()
    const result = db.prepare(
      `INSERT INTO transactions (account_id, title, type, category_id, amount, occurred_at, recurring_id, created_at, updated_at)
       VALUES (@account_id, @title, @type, @category_id, @amount, @occurred_at, @recurring_id, @created_at, @updated_at)`
    ).run({ ...data, created_at: timestamp, updated_at: timestamp })
    return db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid) as Transaction
  })

  ipcMain.handle('transactions:update', (_, id: number, data: Partial<Omit<Transaction, 'id' | 'created_at' | 'updated_at'>>): Transaction => {
    const db = getDb()
    const fields = Object.keys(data)
      .map(k => `${k} = @${k}`)
      .join(', ')
    db.prepare(`UPDATE transactions SET ${fields}, updated_at = @updated_at WHERE id = @id`).run({
      ...data,
      id,
      updated_at: now(),
    })
    return db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Transaction
  })

  ipcMain.handle('transactions:delete', (_, id: number): void => {
    getDb().prepare('DELETE FROM transactions WHERE id = ?').run(id)
  })

  // --- Recurring Rules ---
  ipcMain.handle('recurring-rules:list', (): RecurringRule[] => {
    return getDb().prepare('SELECT * FROM recurring_rules ORDER BY start_date').all() as RecurringRule[]
  })

  ipcMain.handle('recurring-rules:create', (_, data: Omit<RecurringRule, 'id' | 'last_posted'>): RecurringRule => {
    const db = getDb()
    const result = db.prepare(
      `INSERT INTO recurring_rules (account_id, title, type, category_id, amount, frequency, interval_days, start_date, end_date, active)
       VALUES (@account_id, @title, @type, @category_id, @amount, @frequency, @interval_days, @start_date, @end_date, @active)`
    ).run(data)
    return db.prepare('SELECT * FROM recurring_rules WHERE id = ?').get(result.lastInsertRowid) as RecurringRule
  })

  ipcMain.handle('recurring-rules:update', (_, id: number, data: Partial<Omit<RecurringRule, 'id' | 'last_posted'>>): RecurringRule => {
    const db = getDb()
    const fields = Object.keys(data)
      .map(k => `${k} = @${k}`)
      .join(', ')
    db.prepare(`UPDATE recurring_rules SET ${fields} WHERE id = @id`).run({ ...data, id })
    return db.prepare('SELECT * FROM recurring_rules WHERE id = ?').get(id) as RecurringRule
  })

  ipcMain.handle('recurring-rules:delete', (_, id: number): void => {
    getDb().prepare('DELETE FROM recurring_rules WHERE id = ?').run(id)
  })
}
