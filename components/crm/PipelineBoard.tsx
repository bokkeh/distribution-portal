'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  pointerWithin,
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
import * as Popover from '@radix-ui/react-popover'
import { Clock3, GripVertical, Plus, Search, Trash2 } from 'lucide-react'
import {
  createPipelineStage,
  deletePipelineStage,
  renameCRMAccount,
  renamePipelineStage,
  reorderPipelineStages,
  updateDealStage,
  type InlineCRMAccountUpdate,
} from '@/actions/crm'
import { getPipelineStageColorClass } from '@/lib/deal-stages'
import type { PipelineStage } from '@/lib/deal-stages'
import { getBusinessTypeColor } from '@/lib/customers/business-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DealStageSelect } from './DealStageSelect'
import { PipelineCardSettings, usePipelineCardFields, type PipelineCardFieldOption } from './PipelineCardSettings'
import {
  applyInlineAccountUpdate,
  EMPTY_INLINE_ACCOUNT_OPTIONS,
  InlineAccountFieldSelect,
  INLINE_BUSINESS_TYPE_OPTIONS,
  type InlineAccountOption,
} from './InlineAccountFieldSelect'

const ACCOUNT_CARD_FIELD_OPTIONS: PipelineCardFieldOption[] = [
  { key: 'businessType', label: 'Business Type' },
  { key: 'region', label: 'Region' },
]
const ACCOUNT_CARD_DEFAULT_FIELDS: string[] = []

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
  businessType?: string | null
  daysSinceLastOrder?: number | null
  pullThroughScore?: number | null
  regionId?: string | null
  regionName?: string | null
}

interface Props {
  accounts: Account[]
  basePath: string
  stages: PipelineStage[]
  canManageStages?: boolean
  canCreateAccounts?: boolean
  regionColors?: Record<string, string>
  regionOptions?: InlineAccountOption[]
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

const STAGE_TONES: Record<string, { shell: string; title: string; count: string; action: string }> = {
  slate: { shell: 'border-amber-200 bg-amber-50', title: 'text-amber-500', count: 'bg-amber-500', action: 'bg-amber-100/70 hover:bg-amber-100' },
  blue: { shell: 'border-blue-200 bg-blue-50', title: 'text-blue-500', count: 'bg-blue-500', action: 'bg-blue-100/70 hover:bg-blue-100' },
  amber: { shell: 'border-orange-200 bg-orange-50', title: 'text-[#ff5a00]', count: 'bg-[#ff5a00]', action: 'bg-orange-100/70 hover:bg-orange-100' },
  violet: { shell: 'border-violet-200 bg-violet-50', title: 'text-violet-500', count: 'bg-violet-500', action: 'bg-violet-100/70 hover:bg-violet-100' },
  green: { shell: 'border-emerald-200 bg-emerald-50', title: 'text-emerald-500', count: 'bg-emerald-500', action: 'bg-emerald-100/70 hover:bg-emerald-100' },
  red: { shell: 'border-rose-200 bg-rose-50', title: 'text-rose-500', count: 'bg-rose-500', action: 'bg-rose-100/70 hover:bg-rose-100' },
  teal: { shell: 'border-teal-200 bg-teal-50', title: 'text-teal-500', count: 'bg-teal-500', action: 'bg-teal-100/70 hover:bg-teal-100' },
  pink: { shell: 'border-pink-200 bg-pink-50', title: 'text-pink-500', count: 'bg-pink-500', action: 'bg-pink-100/70 hover:bg-pink-100' },
}

function getStageTone(stage: PipelineStage) {
  const stageName = `${stage.stageKey} ${stage.label}`.toLowerCase()
  if (stageName.includes('check back')) return STAGE_TONES.slate
  if (stageName.includes('connected')) return STAGE_TONES.green
  if (stageName.includes('appt') || stageName.includes('appointment')) return STAGE_TONES.blue
  if (stageName.includes('order placed')) return STAGE_TONES.amber
  if (stageName.includes('committed')) return STAGE_TONES.violet
  if (stageName.includes('won') || stageName.includes('onboard')) return STAGE_TONES.green
  return STAGE_TONES[stage.colorToken] ?? STAGE_TONES.slate
}

function getPullThroughTone(score: number | null | undefined) {
  if (score == null || score < 40) return 'bg-red-500'
  if (score < 75) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function AccountCard({
  account,
  basePath,
  isDragging = false,
  isRenaming = false,
  onRename,
  onInlineChange,
  regionColors,
  regionOptions,
  cardFields,
  stages,
  onQuickMove,
}: {
  account: Account
  basePath: string
  isDragging?: boolean
  isRenaming?: boolean
  onRename: (accountId: string, companyName: string) => void
  onInlineChange: (accountId: string, update: InlineCRMAccountUpdate) => void
  regionColors: Record<string, string>
  regionOptions: InlineAccountOption[]
  cardFields: ReadonlySet<string>
  stages: PipelineStage[]
  onQuickMove: (accountId: string, nextStage: string) => void
}) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState(account.companyName)
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: getAccountDragId(account.id),
    data: {
      type: 'account',
      accountId: account.id,
    },
  })

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const location = [account.city, account.state].filter(Boolean).join(', ')
  const businessType = account.businessType?.replaceAll('_', ' ') || 'Unspecified'
  const score = account.pullThroughScore
  const regionColor = account.regionName ? regionColors[account.regionName] : undefined

  useEffect(() => () => {
    if (navigationTimer.current) clearTimeout(navigationTimer.current)
  }, [])

  function beginEditing() {
    if (navigationTimer.current) clearTimeout(navigationTimer.current)
    setNameDraft(account.companyName)
    setIsEditing(true)
  }

  function saveName() {
    const nextName = nameDraft.trim().replace(/\s+/g, ' ')
    setIsEditing(false)
    if (!nextName || nextName === account.companyName) {
      setNameDraft(account.companyName)
      return
    }
    onRename(account.id, nextName)
  }

  function handleNameClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (event.detail > 1) {
      if (navigationTimer.current) clearTimeout(navigationTimer.current)
      return
    }
    navigationTimer.current = setTimeout(() => router.push(`${basePath}/${account.id}`), 350)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isEditing ? {} : listeners)}
      {...(isEditing ? {} : attributes)}
      className={`group relative cursor-grab touch-none rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition-shadow hover:shadow-[0_12px_28px_rgba(15,23,42,0.13)] active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
    >
      <span
        aria-hidden="true"
        className="absolute right-3 top-3 rounded p-1 text-slate-300 opacity-40 transition group-hover:opacity-100"
      >
        <GripVertical className="h-4 w-4" />
      </span>

      <div className="min-h-16 pr-6">
        {isEditing ? (
          <input
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={saveName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                setNameDraft(account.companyName)
                setIsEditing(false)
              }
            }}
            autoFocus
            maxLength={200}
            aria-label={`Rename ${account.companyName}`}
            className="w-full rounded-md border border-[#ff5a00] bg-white px-2 py-1 text-base font-bold leading-tight text-slate-950 outline-none ring-2 ring-orange-100"
          />
        ) : (
          <button
            type="button"
            onClick={handleNameClick}
            onDoubleClick={beginEditing}
            onKeyDown={(event) => {
              if (event.key === 'F2') beginEditing()
            }}
            title="Open account · Double-click to rename"
            className="text-left text-base font-bold leading-tight text-slate-950 decoration-[#ff5a00] underline-offset-4 hover:text-[#d94c00] hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a00]"
          >
            {account.companyName}
          </button>
        )}
        <p className="mt-1.5 text-sm text-[#817b76]">{location || 'Location not entered'}</p>
      </div>

      <div className="mt-3" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
        <DealStageSelect
          accountId={account.id}
          currentStage={account.dealStage}
          stages={stages}
          size="sm"
          onStageChange={(nextStage) => onQuickMove(account.id, nextStage)}
        />
      </div>

      {(cardFields.has('businessType') || cardFields.has('region')) ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {cardFields.has('businessType') ? (
            <InlineAccountFieldSelect
              accountId={account.id}
              accountName={account.companyName}
              field="businessType"
              value={account.businessType}
              currentLabel={businessType}
              options={INLINE_BUSINESS_TYPE_OPTIONS}
              toneColor={getBusinessTypeColor(account.businessType)}
              onChange={(update) => onInlineChange(account.id, update)}
            />
          ) : null}
          {cardFields.has('region') ? (
            <InlineAccountFieldSelect
              accountId={account.id}
              accountName={account.companyName}
              field="regionId"
              value={account.regionId}
              currentLabel={account.regionName ?? 'Unassigned'}
              options={regionOptions}
              toneColor={regionColor ?? '#94A3B8'}
              onChange={(update) => onInlineChange(account.id, update)}
            />
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm text-[#817b76]">
          <Clock3 className="h-4 w-4" />
          {account.daysSinceLastOrder == null ? '—' : `${account.daysSinceLastOrder}d`}
        </span>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-3">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-[#817b76]">Pull-through Score</span>
          <span className="font-bold text-slate-950">{score == null ? '—' : `${score}%`}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full transition-[width] ${getPullThroughTone(score)}`} style={{ width: `${score ?? 0}%` }} />
        </div>
      </div>

      {isRenaming ? <span className="absolute bottom-3 right-3 h-2 w-2 animate-pulse rounded-full bg-[#ff5a00]" aria-label="Saving account name" /> : null}
    </div>
  )
}

function AddAccountPopover({
  stage,
  allAccounts,
  excludedAccountIds,
  actionClassName,
  onAssign,
}: {
  stage: PipelineStage
  allAccounts: Account[]
  excludedAccountIds: Set<string>
  actionClassName: string
  onAssign: (accountId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const normalizedQuery = query.trim().toLowerCase()
  const results = allAccounts
    .filter((account) => !excludedAccountIds.has(account.id))
    .filter((account) => {
      if (!normalizedQuery) return true
      const haystack = `${account.companyName} ${account.city ?? ''} ${account.state ?? ''}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
    .slice(0, 50)

  function handleSelect(accountId: string) {
    onAssign(accountId)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery('') }}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold text-slate-950 transition ${actionClassName}`}
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={8} className="z-50 w-72 max-w-[85vw] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
            Add account to {stage.label}
          </p>
          <div className="relative px-1 pb-2">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search accounts..."
              className="w-full rounded-md border border-slate-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-[#ff5a00]"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {results.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-slate-400">No matching accounts</p>
            ) : (
              results.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => handleSelect(account.id)}
                  className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left text-sm transition hover:bg-slate-100"
                >
                  <span className="font-medium text-slate-900">{account.companyName}</span>
                  <span className="text-xs text-slate-400">{[account.city, account.state].filter(Boolean).join(', ') || 'No location'}</span>
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function StageColumn({
  stage,
  stages,
  accounts,
  allAccounts,
  basePath,
  activeId,
  canManageStages,
  canCreateAccounts,
  stageLabelDraft,
  onStageLabelChange,
  onStageRename,
  onStageDelete,
  renamingAccountId,
  onAccountRename,
  onInlineChange,
  onAccountAssign,
  onQuickMove,
  isSaving,
  regionColors,
  regionOptions,
  cardFields,
}: {
  stage: PipelineStage
  stages: PipelineStage[]
  accounts: Account[]
  allAccounts: Account[]
  basePath: string
  activeId: string | null
  canManageStages: boolean
  canCreateAccounts: boolean
  stageLabelDraft: string
  onStageLabelChange: (stageId: string, value: string) => void
  onStageRename: (stageId: string) => void
  onStageDelete: (stageId: string) => void
  renamingAccountId: string | null
  onAccountRename: (accountId: string, companyName: string) => void
  onInlineChange: (accountId: string, update: InlineCRMAccountUpdate) => void
  onAccountAssign: (accountId: string, stageKey: string) => void
  onQuickMove: (accountId: string, nextStage: string) => void
  isSaving: boolean
  regionColors: Record<string, string>
  regionOptions: InlineAccountOption[]
  cardFields: ReadonlySet<string>
}) {
  const [isEditingStage, setIsEditingStage] = useState(false)
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
  const tone = getStageTone(stage)
  const stageAccountIds = useMemo(() => new Set(accounts.map((account) => account.id)), [accounts])

  function saveStageName() {
    setIsEditingStage(false)
    if (stageLabelDraft.trim() && stageLabelDraft.trim() !== stage.label) onStageRename(stage.id)
  }

  return (
    <div ref={setSortableNodeRef} style={style} className="w-[290px] flex-shrink-0">
      <div className={`group sticky top-0 z-20 rounded-2xl border p-4 shadow-sm ${tone.shell}`}>
        <div className="flex min-h-9 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {canManageStages ? (
              <button
                type="button"
                {...attributes}
                {...listeners}
                className="shrink-0 cursor-grab text-slate-400 hover:text-slate-700 active:cursor-grabbing"
                aria-label={`Move ${stage.label}`}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            ) : null}
            {isEditingStage ? (
              <input
                value={stageLabelDraft}
                onChange={(event) => onStageLabelChange(stage.id, event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                onBlur={saveStageName}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') {
                    onStageLabelChange(stage.id, stage.label)
                    setIsEditingStage(false)
                  }
                }}
                autoFocus
                aria-label={`Rename ${stage.label}`}
                className="min-w-0 flex-1 rounded-md border border-white/80 bg-white/80 px-2 py-1 font-display text-lg font-bold uppercase text-slate-950 outline-none"
              />
            ) : canManageStages ? (
              <button
                type="button"
                onDoubleClick={() => setIsEditingStage(true)}
                onKeyDown={(event) => {
                  if (event.key === 'F2') setIsEditingStage(true)
                }}
                title="Double-click to rename this stage"
                className={`truncate text-left font-display text-xl font-bold uppercase leading-none tracking-[0.02em] ${tone.title}`}
              >
                {stage.label}
              </button>
            ) : (
              <span className={`truncate font-display text-xl font-bold uppercase leading-none tracking-[0.02em] ${tone.title}`}>{stage.label}</span>
            )}
          </div>
          <span className={`inline-flex min-w-8 items-center justify-center rounded-full px-2 py-1 text-sm font-bold text-white ${tone.count}`}>{accounts.length}</span>
        </div>
        {(canCreateAccounts || canManageStages) ? (
          <div className="mt-3 flex items-center gap-2">
            {canCreateAccounts ? (
              <AddAccountPopover
                stage={stage}
                allAccounts={allAccounts}
                excludedAccountIds={stageAccountIds}
                actionClassName={tone.action}
                onAssign={(accountId) => onAccountAssign(accountId, stage.stageKey)}
              />
            ) : null}
            {canManageStages ? (
              <Button type="button" size="icon" variant="ghost" className={`h-9 w-9 ${tone.action}`} disabled={isSaving} onClick={() => onStageDelete(stage.id)} aria-label={`Delete ${stage.label} stage`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        ref={setDropNodeRef}
        className={`mt-4 min-h-28 space-y-4 rounded-2xl transition-colors ${
          isOver ? 'bg-orange-50/70 p-2 ring-2 ring-[#ff5a00] ring-inset' : ''
        }`}
      >
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            basePath={basePath}
            isDragging={getAccountDragId(account.id) === activeId}
            isRenaming={renamingAccountId === account.id}
            onRename={onAccountRename}
            onInlineChange={onInlineChange}
            regionColors={regionColors}
            regionOptions={regionOptions}
            cardFields={cardFields}
            stages={stages}
            onQuickMove={onQuickMove}
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
  regionColors = {},
  regionOptions = EMPTY_INLINE_ACCOUNT_OPTIONS,
}: Props) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [stages, setStages] = useState<PipelineStage[]>(initialStages)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<'account' | 'stage' | null>(null)
  const [renamingAccountId, setRenamingAccountId] = useState<string | null>(null)
  const [newStageLabel, setNewStageLabel] = useState('')
  const [stageLabels, setStageLabels] = useState<Record<string, string>>(
    Object.fromEntries(initialStages.map((stage) => [stage.id, stage.label]))
  )
  const [, startTransition] = useTransition()
  const inlineRegionOptions = useMemo(() => [{ value: '', label: 'Unassigned' }, ...regionOptions], [regionOptions])
  const { selectedFields: cardFields, toggleField: toggleCardField, resetFields: resetCardFields } = usePipelineCardFields({
    storageKey: 'crm-pipeline-account-card-fields:v1',
    options: ACCOUNT_CARD_FIELD_OPTIONS,
    defaults: ACCOUNT_CARD_DEFAULT_FIELDS,
  })

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

  function handleAccountAssign(accountId: string, stageKey: string) {
    const account = accounts.find((item) => item.id === accountId)
    if (!account || account.dealStage === stageKey) return

    const previousStage = account.dealStage
    setAccounts((prev) => prev.map((item) => item.id === accountId ? { ...item, dealStage: stageKey } : item))

    startTransition(async () => {
      try {
        await updateDealStage(accountId, stageKey)
        toast.success('Account added to stage')
      } catch (error) {
        setAccounts((prev) => prev.map((item) => item.id === accountId ? { ...item, dealStage: previousStage } : item))
        toast.error(error instanceof Error ? error.message : 'Failed to add account to stage')
      }
    })
  }

  function handleStageLabelChange(stageId: string, value: string) {
    setStageLabels((prev) => ({ ...prev, [stageId]: value }))
  }

  function handleAccountRename(accountId: string, companyName: string) {
    const previousName = accounts.find((account) => account.id === accountId)?.companyName
    if (!previousName || previousName === companyName) return

    setRenamingAccountId(accountId)
    setAccounts((prev) => prev.map((account) => account.id === accountId ? { ...account, companyName } : account))

    startTransition(async () => {
      try {
        const updated = await renameCRMAccount(accountId, companyName)
        setAccounts((prev) => prev.map((account) => account.id === accountId ? { ...account, companyName: updated.companyName } : account))
        toast.success('Account name updated')
      } catch (error) {
        setAccounts((prev) => prev.map((account) => account.id === accountId ? { ...account, companyName: previousName } : account))
        toast.error(error instanceof Error ? error.message : 'Failed to update account name')
      } finally {
        setRenamingAccountId((current) => current === accountId ? null : current)
      }
    })
  }

  function handleQuickMove(accountId: string, nextStage: string) {
    setAccounts((prev) => prev.map((item) => item.id === accountId ? { ...item, dealStage: nextStage } : item))
  }

  function handleInlineChange(accountId: string, update: InlineCRMAccountUpdate) {
    setAccounts((prev) => prev.map((account) => account.id === accountId ? applyInlineAccountUpdate(account, update) : account))
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
      <div className="flex justify-end">
        <PipelineCardSettings
          options={ACCOUNT_CARD_FIELD_OPTIONS}
          selectedFields={cardFields}
          onToggle={toggleCardField}
          onReset={resetCardFields}
        />
      </div>
      {canManageStages ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-display text-lg font-bold uppercase text-slate-950">Manage pipeline</p>
              <p className="text-xs text-slate-500">Drag cards between stages. Double-click an account or stage name to rename it.</p>
            </div>
            <div className="flex w-full max-w-md items-center gap-2">
              <Input value={newStageLabel} onChange={(event) => setNewStageLabel(event.target.value)} placeholder="Add a new pipeline column" />
              <Button type="button" onClick={handleCreateStage} className="shrink-0 bg-[#ff5a00] font-display uppercase hover:bg-[#e65000]">
                <Plus className="mr-2 h-4 w-4" />
                Add Column
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={stages.map((stage) => getStageSortId(stage.id))} strategy={horizontalListSortingStrategy}>
          <div className="max-h-[calc(100vh-14rem)] overflow-auto overscroll-contain pb-6 pt-1 [scrollbar-color:#cbd5e1_transparent]">
            <div className="flex min-h-full items-stretch gap-6">
              {stageAccounts.map(({ stage, accounts: columnAccounts }) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  stages={stages}
                  accounts={columnAccounts}
                  allAccounts={accounts}
                  basePath={basePath}
                  activeId={activeId}
                  canManageStages={canManageStages}
                  canCreateAccounts={canCreateAccounts}
                  stageLabelDraft={stageLabels[stage.id] ?? stage.label}
                  onStageLabelChange={handleStageLabelChange}
                  onStageRename={handleStageRename}
                  onStageDelete={handleStageDelete}
                  renamingAccountId={renamingAccountId}
                  onAccountRename={handleAccountRename}
                  onInlineChange={handleInlineChange}
                  onAccountAssign={handleAccountAssign}
                  onQuickMove={handleQuickMove}
                  isSaving={false}
                  regionColors={regionColors}
                  regionOptions={inlineRegionOptions}
                  cardFields={cardFields}
                />
              ))}
            </div>
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
