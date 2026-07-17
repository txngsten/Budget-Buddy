import React, { useEffect, useState, useCallback } from 'react'
import type { Account, Category } from '../shared/types'
import Sidebar from './components/Sidebar'
import LandingPage from './pages/LandingPage'
import SettingsPage from './pages/SettingsPage'
import AccountPage from './pages/AccountPage'
import ProjectionsPage from './pages/ProjectionsPage'
import AddItemModal from './components/AddItemModal'

export type Page = 'landing' | 'projections' | 'settings' | { type: 'account'; id: number }

export default function App() {
  const [page, setPage] = useState<Page>('landing')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [addItemAccountId, setAddItemAccountId] = useState<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadData = useCallback(async () => {
    setAccounts(await window.api.accounts.list())
    setCategories(await window.api.categories.list())
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData, refreshKey])

  function triggerRefresh() {
    setRefreshKey(k => k + 1)
  }

  let content: React.ReactNode
  if (page === 'landing') {
    content = <LandingPage accounts={accounts} onAccountsChanged={triggerRefresh} />
  } else if (page === 'settings') {
    content = <SettingsPage onDataChanged={triggerRefresh} />
  } else if (page === 'projections') {
    content = <ProjectionsPage accounts={accounts} categories={categories} />
  } else {
    content = (
      <AccountPage
        key={page.id}
        accountId={page.id}
        allAccounts={accounts}
        categories={categories}
        onAccountsChanged={triggerRefresh}
      />
    )
  }

  return (
    <div className="app-layout">
      <Sidebar
        currentPage={page}
        onNavigate={setPage}
        accounts={accounts}
        onAddItem={(accountId) => setAddItemAccountId(accountId)}
      />
      <main className="main-content">
        {content}
      </main>

      {addItemAccountId !== null && (
        <AddItemModal
          accounts={accounts}
          categories={categories}
          presetAccountId={addItemAccountId}
          onSave={() => { setAddItemAccountId(null); triggerRefresh() }}
          onClose={() => setAddItemAccountId(null)}
        />
      )}
    </div>
  )
}
