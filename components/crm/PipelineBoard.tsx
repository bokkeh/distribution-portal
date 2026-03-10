'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { DEAL_STAGES } from '@/lib/deal-stages'
import { updateDealStage } from '@/actions/crm'
import { formatCurrency } from '@/lib/utils'
import { GripVertical } from 'lucide-react'

interface Account {
  id: string
  companyName: string
  dealStage: string | null
  city: string | null
  state: string | null
  balance: string | null
  contactName: string | null
}

interface Props {
  accounts: Account[]
  basePath: string
}

// ── Draggable card ────────────────────────────────────────────────────────────
function AccountCard({
  account,
  basePath,
  isDragging = false,
}: {
  account: Account
  basePath: string
  isDragging?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: account.id })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-2 ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-start gap-1">
        <button
          {...listeners}
          {...attributes}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 shrink-0"
          aria-label="Drag to move"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <Link
          href={`${basePath}/${account.id}`}
          className="block text-sm font-semibold text-slate-900 hover:text-blue-600 leading-tight flex-1"
        >
          {account.companyName}
        </Link>
      </div>
      {(account.city || account.state) && (
        <p className="text-xs text-muted-foreground pl-5">
          {[account.city, account.state].filter(Boolean).join(', ')}
        </p>
      )}
      {account.balance && parseFloat(account.balance) > 0 && (
        <p className="text-xs text-slate-500 pl-5">
          Balance: <span className="font-medium text-slate-700">{formatCurrency(account.balance)}</span>
        </p>
      )}
    </div>
  )
}

// ── Droppable column ──────────────────────────────────────────────────────────
function StageColumn({
  stage,
  accounts,
  basePath,
  activeId,
}: {
  stage: typeof DEAL_STAGES[number]
  accounts: Account[]
  basePath: string
  activeId: string | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.value })

  return (
    <div className="flex-shrink-0 w-64">
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border ${stage.color}`}>
        <span className="text-xs font-semibold uppercase tracking-wide">{stage.label}</span>
        <span className="text-xs font-bold">{accounts.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={`space-y-2 mt-2 min-h-24 rounded-b-lg p-1 transition-colors ${
          isOver ? 'bg-slate-100 ring-2 ring-slate-300 ring-inset' : ''
        }`}
      >
        {accounts.map(account => (
          <AccountCard
            key={account.id}
            account={account}
            basePath={basePath}
            isDragging={account.id === activeId}
          />
        ))}
        {accounts.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            {isOver ? 'Drop here' : 'No accounts'}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Board ─────────────────────────────────────────────────────────────────────
export function PipelineBoard({ accounts: initialAccounts, basePath }: Props) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const activeAccount = accounts.find(a => a.id === activeId) ?? null

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over || active.id === over.id) return

    const newStage = over.id as string
    const account = accounts.find(a => a.id === active.id)
    if (!account || account.dealStage === newStage) return

    // Optimistic update
    setAccounts(prev =>
      prev.map(a => a.id === active.id ? { ...a, dealStage: newStage } : a)
    )

    startTransition(async () => {
      try {
        await updateDealStage(active.id as string, newStage)
        toast.success('Stage updated')
      } catch {
        // Revert on failure
        setAccounts(prev =>
          prev.map(a => a.id === active.id ? { ...a, dealStage: account.dealStage } : a)
        )
        toast.error('Failed to update stage')
      }
    })
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {DEAL_STAGES.map(stage => (
          <StageColumn
            key={stage.value}
            stage={stage}
            accounts={accounts.filter(a => (a.dealStage ?? 'new_lead') === stage.value)}
            basePath={basePath}
            activeId={activeId}
          />
        ))}
      </div>

      <DragOverlay>
        {activeAccount ? (
          <div className="bg-white rounded-lg border border-slate-300 shadow-xl p-3 w-64 rotate-1 opacity-95">
            <p className="text-sm font-semibold text-slate-900">{activeAccount.companyName}</p>
            {(activeAccount.city || activeAccount.state) && (
              <p className="text-xs text-muted-foreground mt-1">
                {[activeAccount.city, activeAccount.state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
