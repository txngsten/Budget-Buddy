export interface Account {
  id: number
  name: string
  type: string
  seed_balance: number
  sort_order: number
  archived: number
  created_at: string
}

export interface Category {
  id: number
  name: string
  colour: string
  parent_id: number | null
  archived: number
  created_at: string
}

export interface Transaction {
  id: number
  account_id: number
  title: string
  type: 'income' | 'spend'
  category_id: number | null
  amount: number
  occurred_at: string
  recurring_id: number | null
  created_at: string
  updated_at: string
}

export interface RecurringRule {
  id: number
  account_id: number
  title: string
  type: 'income' | 'spend'
  category_id: number | null
  amount: number
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'custom'
  interval_days: number | null
  start_date: string
  end_date: string | null
  last_posted: string | null
  active: number
}

export interface IpcApi {
  accounts: {
    list: () => Promise<Account[]>
    create: (data: Omit<Account, 'id' | 'created_at'>) => Promise<Account>
    update: (id: number, data: Partial<Omit<Account, 'id' | 'created_at'>>) => Promise<Account>
    archive: (id: number) => Promise<void>
    unarchive: (id: number) => Promise<void>
  }
  categories: {
    list: () => Promise<Category[]>
    create: (data: Omit<Category, 'id' | 'created_at'>) => Promise<Category>
    update: (id: number, data: Partial<Omit<Category, 'id' | 'created_at'>>) => Promise<Category>
    archive: (id: number) => Promise<void>
    unarchive: (id: number) => Promise<void>
  }
  transactions: {
    list: (filters?: { account_id?: number; start?: string; end?: string }) => Promise<Transaction[]>
    create: (data: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => Promise<Transaction>
    update: (id: number, data: Partial<Omit<Transaction, 'id' | 'created_at' | 'updated_at'>>) => Promise<Transaction>
    delete: (id: number) => Promise<void>
  }
  recurringRules: {
    list: () => Promise<RecurringRule[]>
    create: (data: Omit<RecurringRule, 'id' | 'last_posted'>) => Promise<RecurringRule>
    update: (id: number, data: Partial<Omit<RecurringRule, 'id' | 'last_posted'>>) => Promise<RecurringRule>
    delete: (id: number) => Promise<void>
  }
}
