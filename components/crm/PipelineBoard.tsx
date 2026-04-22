'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { GripVertical, PencilLine, Plus, Trash2 } from 'lucide-react'
import {
  createPipelineStage,
  deletePipelineStage,
  renamePipelineStage,
  reorderPipelineStages,
  updateDealStage,
} from '@/actions/crm'
import { getPipelineStageColorClass } from '@/lib/deal-stages'
import { formatCurrency } from '@/lib/utils'
import type { PipelineStage } from '@/lib/deal-stages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Account {
  id: string
  companyName: string
  firstName: string | null
  lastName: string | null
  dealStage: string | null
  city: string | null
  state: string | null
  balance: string | null
  contactName: string | null
}

interface Props {
  accounts: Account[]
  basePath: string
  stages: PipelineStage[]
  canManageStages?: boolean
  canCreateAccounts?: boolean
}

function getAccountDragId(accountId: string) {
  return `account:${accountId}`
}

function getStageSortId(stageId: string) {
  return `stage:${stageId}`
}

function getStageDropId(stageId: string) {
  return `stage-drop:${stageId}`
}

function AccountCard({
  account,
  basePath,
  isDragging = false,
}: {
  account: Account
  basePath: string
  isDragging?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: getAccountDragId(account.id),
    data: {
      type: 'account',
      accountId: account.id,
    },
  })

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const fallbackName = [account.firstName, account.lastName].filter(Boolean).join(' ').trim()
  const subtitle = account.contactName ?? (fallbackName || null)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start gap-1">
        <button
          {...listeners}
          {...attributes}
          className="mt-0.5 shrink-0 cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
          aria-label="Drag to move"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <Link
          href={`${basePath}/${account.id}`}
          className="block flex-1 text-sm font-semibold leading-tight text-slate-900 hover:text-blue-600"
        >
          {account.companyName}
        </Link>
      </div>
      {subtitle ? (
        <p className="pl-5 text-xs text-slate-500">{subtitle}</p>
      ) : null}
      {(account.city || account.state) ? (
        <p className="pl-5 text-xs text-muted-foreground">
          {[account.city, account.state].filter(Boolean).join(', ')}
        </p>
      ) : null}
      {account.balance && parseFloat(account.balance) > 0 ? (
        <p className="pl-5 text-xs text-slate-500">
          Balance: <span className="font-medium text-slate-700">{formatCurrency(account.balance)}</span>
        </p>
      ) : null}
    </div>
  )
}

function StageColumn({
  stage,
  accounts,
  basePath,
  activeId,
  canManageStages,
  canCreateAccounts,
  stageLabelDraft,
  onStageLabelChange,
  onStageRename,
  onStageDelete,
  isSaving,
}: {
  stage: PipelineStage
  accounts: Account[]
  basePath: string
  activeId: string | null
  canManageStages: boolean
  canCreateAccounts: boolean
  stageLabelDraft: string
  onStageLabelChange: (stageId: string, value: string) => void
  onStageRename: (stageId: string) => void
  onStageDelete: (stageId: string) => void
  isSaving: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableNodeRef,
    transform,
    transition,
  } = useSortable({
    id: getStageSortId(stage.id),
    data: {
      type: 'stage',
      stageId: stage.id,
      stageKey: stage.stageKey,
    },
    disabled: !canManageStages,
  })
  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: getStageDropId(stage.id),
    data: {
      type: 'stage-drop',
      stageId: stage.id,
      stageKey: stage.stageKey,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setSortableNodeRef} style={style} className="w-72 flex-shrink-0">
      <div className={`rounded-t-lg border px-3 py-2 ${stage.colorClass}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {canManageStages ? (
              <button
                type="button"
                {...attributes}
                {...listeners}
                className="shrink-0 cursor-grab text-slate-500 hover:text-slate-700 active:cursor-grabbing"
                aria-label={`Move ${stage.label}`}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <span className="truncate text-xs font-semibold uppercase tracking-wide">{stage.label}</span>
          </div>
          <span className="text-xs font-bold">{accounts.length}</span>
        </div>
        {(canCreateAccounts || canManageStages) ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {canCreateAccounts ? (
              <Link href={`/admin/crm/new?stage=${encodeURIComponent(stage.stageKey)}`}>
                <Button variant="secondary" size="sm" className="h-7 gap-1.5 px-2 text-[11px]">
                  <Plus className="h-3.5 w-3.5" />
                  New
                </Button>
              </Link>
            ) : null}
            {canManageStages ? (
              <>
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-white/60 bg-white/70 px-2 py-1">
                  <PencilLine className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <input
                    value={stageLabelDraft}
                    onChange={(event) => onStageLabelChange(stage.id, event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none"
                    aria-label={`Rename ${stage.label}`}
                  />
                </div>
                <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[11px]" disabled={isSaving} onClick={() => onStageRename(stage.id)}>
                  Save
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={isSaving} onClick={() => onStageDelete(stage.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        ref={setDropNodeRef}
        className={`mt-2 min-h-24 space-y-2 rounded-b-lg p-1 transition-colors ${
          isOver ? 'bg-slate-100 ring-2 ring-slate-300 ring-inset' : ''
        }`}
      >
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            basePath={basePath}
            isDragging={getAccountDragId(account.id) === activeId}
          />
        ))}
        {accounts.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {isOver ? 'Drop here' : 'No accounts'}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function PipelineBoard({
  accounts: initialAccounts,
  basePath,
  stages: initialStages,
  canManageStages = false,
  canCreateAccounts = false,
}: Props) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [stages, setStages] = useState<PipelineStage[]>(initialStages)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<'account' | 'stage' | null>(null)
  const [newStageLabel, setNewStageLabel] = useState('')
  const [stageLabels, setStageLabels] = useState<Record<string, string>>(
    Object.fromEntries(initialStages.map((stage) => [stage.id, stage.label]))
  )
  const [, startTransition] = useTransition()

  useEffect(() => {
    setAccounts(initialAccounts)
  }, [initialAccounts])

  useEffect(() => {
    setStages(initialStages)
    setStageLabels(Object.fromEntries(initialStages.map((stage) => [stage.id, stage.label])))
  }, [initialStages])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const activeAccount = activeType === 'account'
    ? accounts.find((account) => getAccountDragId(account.id) === activeId) ?? null
    : null
  const activeStage = activeType === 'stage'
    ? stages.find((stage) => getStageSortId(stage.id) === activeId) ?? null
    : null

  const stageAccounts = useMemo(
    () => stages.map((stage) => ({
      stage,
      accounts: accounts.filter((account) => (account.dealStage ?? stages[0]?.stageKey ?? 'new_lead') === stage.stageKey),
    })),
    [accounts, stages]
  )

  function onDragStart({ active }: DragStartEvent) {
    const type = active.data.current?.type
    setActiveId(active.id as string)
    setActiveType(type === 'stage' ? 'stage' : 'account')
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const dragType = active.data.current?.type
    setActiveId(null)
    setActiveType(null)

    if (!over) return

    if (dragType === 'stage') {
      const activeStageId = active.data.current?.stageId as string | undefined
      const overStageId = over.data.current?.stageId as string | undefined
      if (!activeStageId || !overStageId || activeStageId === overStageId) return

      const oldIndex = stages.findIndex((stage) => stage.id === activeStageId)
      const newIndex = stages.findIndex((stage) => stage.id === overStageId)
      if (oldIndex === -1 || newIndex === -1) return

      const previousStages = stages
      const nextStages = arrayMove(stages, oldIndex, newIndex).map((stage, index) => ({
        ...stage,
        position: index,
      }))
      setStages(nextStages)

      startTransition(async () => {
        try {
          await reorderPipelineStages(nextStages.map((stage) => stage.id))
          toast.success('Pipeline column order updated')
        } catch (error) {
          setStages(previousStages)
          toast.error(error instanceof Error ? error.message : 'Failed to reorder pipeline columns')
        }
      })
      return
    }

    const accountId = active.data.current?.accountId as string | undefined
    const newStageKey = over.data.current?.stageKey as string | undefined
    if (!accountId || !newStageKey) return

    const account = accounts.find((item) => item.id === accountId)
    if (!account || account.dealStage === newStageKey) return

    setAccounts((prev) => prev.map((item) => item.id === accountId ? { ...item, dealStage: newStageKey } : item))

    startTransition(async () => {
      try {
        await updateDealStage(accountId, newStageKey)
        toast.success('Stage updated')
      } catch {
        setAccounts((prev) => prev.map((item) => item.id === accountId ? { ...item, dealStage: account.dealStage } : item))
        toast.error('Failed to update stage')
      }
    })
  }

  function handleStageLabelChange(stageId: string, value: string) {
    setStageLabels((prev) => ({ ...prev, [stageId]: value }))
  }

  function handleStageRename(stageId: string) {
    const label = stageLabels[stageId]?.trim()
    if (!label) {
      toast.error('Stage label is required')
      return
    }

    const previousStages = stages
    setStages((prev) => prev.map((stage) => stage.id === stageId ? { ...stage, label } : stage))

    startTransition(async () => {
      try {
        const updated = await renamePipelineStage(stageId, label)
        setStages((prev) => prev.map((stage) => stage.id === stageId ? { ...stage, label: updated.label } : stage))
        toast.success('Pipeline column renamed')
      } catch (error) {
        setStages(previousStages)
        setStageLabels((prev) => ({ ...prev, [stageId]: previousStages.find((stage) => stage.id === stageId)?.label ?? prev[stageId] ?? '' }))
        toast.error(error instanceof Error ? error.message : 'Failed to rename pipeline column')
      }
    })
  }

  function handleStageDelete(stageId: string) {
    const previousStages = stages
    const previousAccounts = accounts
    const stageToDelete = previousStages.find((stage) => stage.id === stageId)
    if (!stageToDelete) return
    const fallbackStage = previousStages.find((stage) => stage.id !== stageId)

    setStages((prev) => prev.filter((stage) => stage.id !== stageId).map((stage, index) => ({ ...stage, position: index })))
    if (fallbackStage) {
      setAccounts((prev) => prev.map((account) => account.dealStage === stageToDelete.stageKey ? { ...account, dealStage: fallbackStage.stageKey } : account))
    }

    startTransition(async () => {
      try {
        const result = await deletePipelineStage(stageId)
        setAccounts((prev) => prev.map((account) => account.dealStage === stageToDelete.stageKey ? { ...account, dealStage: result.fallbackStageKey } : account))
        setStageLabels((prev) => {
          const next = { ...prev }
          delete next[stageId]
          return next
        })
        toast.success('Pipeline column removed')
      } catch (error) {
        setStages(previousStages)
        setAccounts(previousAccounts)
        toast.error(error instanceof Error ? error.message : 'Failed to remove pipeline column')
      }
    })
  }

  function handleCreateStage() {
    const label = newStageLabel.trim()
    if (!label) {
      toast.error('Column name is required')
      return
    }

    startTransition(async () => {
      try {
        const created = await createPipelineStage(label)
        const nextStage: PipelineStage = {
          ...created,
          colorClass: getPipelineStageColorClass(created.colorToken),
        }
        setStages((prev) => [...prev, nextStage])
        setStageLabels((prev) => ({ ...prev, [created.id]: created.label }))
        setNewStageLabel('')
        toast.success('Pipeline column added')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to add pipeline column')
      }
    })
  }

  return (
    <div className="space-y-4">
      {canManageStages ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Manage Pipeline Columns</p>
              <p className="text-xs text-slate-500">Rename, remove, add, and drag columns left to right directly on the board.</p>
            </div>
            <div className="flex w-full max-w-md items-center gap-2">
              <Input value={newStageLabel} onChange={(event) => setNewStageLabel(event.target.value)} placeholder="Add a new pipeline column" />
              <Button type="button" onClick={handleCreateStage}>
                <Plus className="mr-2 h-4 w-4" />
                Add Column
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <SortableContext items={stages.map((stage) => getStageSortId(stage.id))} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stageAccounts.map(({ stage, accounts: columnAccounts }) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                accounts={columnAccounts}
                basePath={basePath}
                activeId={activeId}
                canManageStages={canManageStages}
                canCreateAccounts={canCreateAccounts}
                stageLabelDraft={stageLabels[stage.id] ?? stage.label}
                onStageLabelChange={handleStageLabelChange}
                onStageRename={handleStageRename}
                onStageDelete={handleStageDelete}
                isSaving={false}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeAccount ? (
            <div className="w-64 rotate-1 rounded-lg border border-slate-300 bg-white p-3 shadow-xl opacity-95">
              <p className="text-sm font-semibold text-slate-900">{activeAccount.companyName}</p>
              {(activeAccount.city || activeAccount.state) ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {[activeAccount.city, activeAccount.state].filter(Boolean).join(', ')}
                </p>
              ) : null}
            </div>
          ) : null}
          {activeStage ? (
            <div className={`w-72 rounded-lg border px-3 py-3 shadow-xl opacity-95 ${activeStage.colorClass}`}>
              <div className="flex items-center gap-2">
                <GripVertical className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wide">{activeStage.label}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
