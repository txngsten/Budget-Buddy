import React, { useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Account } from '../../shared/types'
import AccountWidget from '../components/AccountWidget'

interface Props {
  accounts: Account[]
  onAccountsChanged: () => void
}

export default function LandingPage({ accounts, onAccountsChanged }: Props) {
  const activeAccounts = accounts
    .filter(a => !a.archived)
    .sort((a, b) => a.sort_order - b.sort_order)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = activeAccounts.findIndex(a => a.id === active.id)
    const newIndex = activeAccounts.findIndex(a => a.id === over.id)
    const reordered = arrayMove(activeAccounts, oldIndex, newIndex)

    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sort_order !== i) {
        await window.api.accounts.update(reordered[i].id, { sort_order: i })
      }
    }
    onAccountsChanged()
  }

  if (activeAccounts.length === 0) {
    return (
      <div className="empty-state">
        <h2>Welcome to Budget Buddy</h2>
        <p>Get started by creating an account in Settings.</p>
      </div>
    )
  }

  return (
    <div className="landing-page">
      <AccountWidget combined accounts={accounts} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={activeAccounts.map(a => a.id)}
          strategy={verticalListSortingStrategy}
        >
          {activeAccounts.map(account => (
            <SortableWidget key={account.id} account={account} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableWidget({ account }: { account: Account }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: account.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="widget-drag-handle" {...listeners}>
        <span className="drag-dots">⠿</span>
      </div>
      <AccountWidget account={account} />
    </div>
  )
}
