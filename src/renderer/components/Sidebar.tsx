import React from 'react'
import type { Page } from '../App'
import type { Account } from '../../shared/types'

interface Props {
  currentPage: Page
  onNavigate: (page: Page) => void
  accounts: Account[]
  onAddItem: (accountId: number) => void
}

export default function Sidebar({ currentPage, onNavigate, accounts, onAddItem }: Props) {
  const activeAccounts = accounts.filter(a => !a.archived)

  function isActive(page: Page): boolean {
    if (typeof currentPage === 'string' && typeof page === 'string') {
      return currentPage === page
    }
    if (typeof currentPage === 'object' && typeof page === 'object') {
      return currentPage.id === page.id
    }
    return false
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Budget Buddy</h1>
      </div>
      <nav className="sidebar-nav">
        <a
          className={`nav-item ${isActive('landing') ? 'active' : ''}`}
          onClick={() => onNavigate('landing')}
        >
          Landing
        </a>

        <div className="nav-section">
          <span className="nav-section-title">Accounts</span>
        </div>
        {activeAccounts.map(account => (
          <a
            key={account.id}
            className={`nav-item nav-account ${isActive({ type: 'account', id: account.id }) ? 'active' : ''}`}
            onClick={() => onNavigate({ type: 'account', id: account.id })}
          >
            <span className="nav-account-name">{account.name}</span>
            <button
              className="nav-account-add"
              onClick={(e) => {
                e.stopPropagation()
                onAddItem(account.id)
              }}
              title="Add Item"
            >
              +
            </button>
          </a>
        ))}

        <a
          className={`nav-item ${isActive('projections') ? 'active' : ''}`}
          onClick={() => onNavigate('projections')}
        >
          Projections
        </a>
        <a
          className={`nav-item ${isActive('settings') ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          Settings
        </a>
      </nav>
    </aside>
  )
}
