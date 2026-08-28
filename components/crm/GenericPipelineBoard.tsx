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
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import {
  createPipelineStage,
  deletePipelineStage,
  renamePipelineStage,
  reorderPipelineStages,
} from '@/actions/crm'
import type { CrmPipelineEntityType } from '@/db/schema'
import { getPipelineStageColorClass } from '@/lib/deal-stages'
import type { PipelineStage } from '@/lib/deal-stages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DealStageSelect } from './DealStageSelect'
import { PipelineCardSettings, usePipelineCardFields, type PipelineCardFieldOption } from './PipelineCardSettings'

export type GenericPipelineItem = {
  id: string
  dealStage: string | null
  title: string
  subtitle?: string | null
  href?: string | null
  fields: Record<string, string | number | null | undefined>
}

interface Props {
  entityType: CrmPipelineEntityType
  items: GenericPipelineItem[]
  stages: PipelineStage[]
  canManageStages?: boolean
  fieldOptions: PipelineCardFieldOption[]
  defaultFields: string[]
  storageKey: string
  updateItemStage: (id: string, stageKey: string) => Promise<unknown>
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
  return STAGE_TONES[stage.colorToken] ?? STAGE_TONES.slate
}

function getItemDragId(itemId: string) {
  return `item:${itemId}`
}
function getStageSortId(stageId: string) {
  return `stage:${stageId}`
}
function getStageDropId(stageId: string) {
  return `stage-drop:${stageId}`
}

function ItemCard({
  item,
  isDragging,
  stages,
  cardFields,
  fieldOptions,
  updateItemStage,
  onQuickMove,
}: {
  item: GenericPipelineItem
  isDragging: boolean
  stages: PipelineStage[]
  cardFields: ReadonlySet<string>
  fieldOptions: PipelineCardFieldOption[]
  updateItemStage: (id: string, stageKey: string) => Promise<unknown>
  onQuickMove: (itemId: string, stageKey: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: getItemDragId(item.id),
    data: { type: 'item', itemId: item.id },
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const visibleFields = fieldOptions.filter((option) => cardFields.has(option.key) && item.fields[option.key])

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group relative cursor-grab touch-none rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition-shadow hover:shadow-[0_12px_28px_rgba(15,23,42,0.13)] active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
    >
      <span aria-hidden="true" className="absolute right-3 top-3 rounded p-1 text-slate-300 opacity-40 transition group-hover:opacity-100">
        <GripVertical className="h-4 w-4" />
      </span>
      <div className="min-h-10 pr-6">
        {item.href ? (
          <Link href={item.href} className="font-semibold leading-tight text-slate-950 decoration-[#ff5a00] underline-offset-4 hover:text-[#d94c00] hover:underline">
            {item.title}
          </Link>
        ) : (
          <p className="font-semibold leading-tight text-slate-950">{item.title}</p>
        )}
        {item.subtitle ? <p className="mt-1.5 text-sm text-[#817b76]">{item.subtitle}</p> : null}
      </div>

      <div className="mt-3" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
        <DealStageSelect
          accountId={item.id}
          currentStage={item.dealStage}
          stages={stages}
          size="sm"
          updateAction={updateItemStage}
          onStageChange={(nextStage) => onQuickMove(item.id, nextStage)}
        />
      </div>

      {visibleFields.length > 0 ? (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {visibleFields.map((field) => (
            <div key={field.key}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{field.label}</p>
              <p className="mt-0.5 break-words text-sm text-slate-600">{item.fields[field.key]}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function StageColumn({
  stage,
  items,
  activeId,
  canManageStages,
  stageLabelDraft,
  onStageLabelChange,
  onStageRename,
  onStageDelete,
  isSaving,
  stages,
  cardFields,
  fieldOptions,
  updateItemStage,
  onQuickMove,
}: {
  stage: PipelineStage
  items: GenericPipelineItem[]
  activeId: string | null
  canManageStages: boolean
  stageLabelDraft: string
  onStageLabelChange: (stageId: string, value: string) => void
  onStageRename: (stageId: string) => void
  onStageDelete: (stageId: string) => void
  isSaving: boolean
  stages: PipelineStage[]
  cardFields: ReadonlySet<string>
  fieldOptions: PipelineCardFieldOption[]
  updateItemStage: (id: string, stageKey: string) => Promise<unknown>
  onQuickMove: (itemId: string, stageKey: string) => void
}) {
  const [isEditingStage, setIsEditingStage] = useState(false)
  const { attributes, listeners, setNodeRef: setSortableNodeRef, transform, transition } = useSortable({
    id: getStageSortId(stage.id),
    data: { type: 'stage', stageId: stage.id, stageKey: stage.stageKey },
    disabled: !canManageStages,
  })
  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: getStageDropId(stage.id),
    data: { type: 'stage-drop', stageId: stage.id, stageKey: stage.stageKey },
  })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const tone = getStageTone(stage)

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
              <button type="button" {...attributes} {...listeners} className="shrink-0 cursor-grab text-slate-400 hover:text-slate-700 active:cursor-grabbing" aria-label={`Move ${stage.label}`}>
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
                  if (event.key === 'Escape') { onStageLabelChange(stage.id, stage.label); setIsEditingStage(false) }
                }}
                autoFocus
                aria-label={`Rename ${stage.label}`}
                className="min-w-0 flex-1 rounded-md border border-white/80 bg-white/80 px-2 py-1 font-display text-lg font-bold uppercase text-slate-950 outline-none"
              />
            ) : canManageStages ? (
              <button type="button" onDoubleClick={() => setIsEditingStage(true)} onKeyDown={(event) => { if (event.key === 'F2') setIsEditingStage(true) }} title="Double-click to rename this stage" className={`truncate text-left font-display text-xl font-bold uppercase leading-none tracking-[0.02em] ${tone.title}`}>
                {stage.label}
              </button>
            ) : (
              <span className={`truncate font-display text-xl font-bold uppercase leading-none tracking-[0.02em] ${tone.title}`}>{stage.label}</span>
            )}
          </div>
          <span className={`inline-flex min-w-8 items-center justify-center rounded-full px-2 py-1 text-sm font-bold text-white ${tone.count}`}>{items.length}</span>
        </div>
        {canManageStages ? (
          <div className="mt-3 flex items-center gap-2">
            <Button type="button" size="icon" variant="ghost" className={`h-9 w-9 ${tone.action}`} disabled={isSaving} onClick={() => onStageDelete(stage.id)} aria-label={`Delete ${stage.label} stage`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>

      <div ref={setDropNodeRef} className={`mt-4 min-h-28 space-y-4 rounded-2xl transition-colors ${isOver ? 'bg-orange-50/70 p-2 ring-2 ring-[#ff5a00] ring-inset' : ''}`}>
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            isDragging={getItemDragId(item.id) === activeId}
            stages={stages}
            cardFields={cardFields}
            fieldOptions={fieldOptions}
            updateItemStage={updateItemStage}
            onQuickMove={onQuickMove}
          />
        ))}
        {items.length === 0 ? <p className="py-6 text-center text-xs text-muted-foreground">{isOver ? 'Drop here' : 'No records'}</p> : null}
      </div>
    </div>
  )
}

export function GenericPipelineBoard({
  entityType,
  items: initialItems,
  stages: initialStages,
  canManageStages = false,
  fieldOptions,
  defaultFields,
  storageKey,
  updateItemStage,
}: Props) {
  const [items, setItems] = useState(initialItems)
  const [stages, setStages] = useState<PipelineStage[]>(initialStages)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<'item' | 'stage' | null>(null)
  const [newStageLabel, setNewStageLabel] = useState('')
  const [stageLabels, setStageLabels] = useState<Record<string, string>>(
    Object.fromEntries(initialStages.map((stage) => [stage.id, stage.label]))
  )
  const [, startTransition] = useTransition()
  const { selectedFields: cardFields, toggleField: toggleCardField, resetFields: resetCardFields } = usePipelineCardFields({
    storageKey,
    options: fieldOptions,
    defaults: defaultFields,
  })

  useEffect(() => setItems(initialItems), [initialItems])
  useEffect(() => {
    setStages(initialStages)
    setStageLabels(Object.fromEntries(initialStages.map((stage) => [stage.id, stage.label])))
  }, [initialStages])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const activeItem = activeType === 'item' ? items.find((item) => getItemDragId(item.id) === activeId) ?? null : null
  const activeStage = activeType === 'stage' ? stages.find((stage) => getStageSortId(stage.id) === activeId) ?? null : null

  const stageItems = useMemo(
    () => stages.map((stage) => ({
      stage,
      items: items.filter((item) => (item.dealStage ?? stages[0]?.stageKey ?? 'new_lead') === stage.stageKey),
    })),
    [items, stages]
  )

  function handleQuickMove(itemId: string, nextStage: string) {
    setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, dealStage: nextStage } : item))
  }

  function onDragStart({ active }: DragStartEvent) {
    const type = active.data.current?.type
    setActiveId(active.id as string)
    setActiveType(type === 'stage' ? 'stage' : 'item')
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
      const nextStages = arrayMove(stages, oldIndex, newIndex).map((stage, index) => ({ ...stage, position: index }))
      setStages(nextStages)

      startTransition(async () => {
        try {
          await reorderPipelineStages(nextStages.map((stage) => stage.id), entityType)
          toast.success('Pipeline column order updated')
        } catch (error) {
          setStages(previousStages)
          toast.error(error instanceof Error ? error.message : 'Failed to reorder pipeline columns')
        }
      })
      return
    }

    const itemId = active.data.current?.itemId as string | undefined
    const newStageKey = over.data.current?.stageKey as string | undefined
    if (!itemId || !newStageKey) return

    const item = items.find((row) => row.id === itemId)
    if (!item || item.dealStage === newStageKey) return

    setItems((prev) => prev.map((row) => row.id === itemId ? { ...row, dealStage: newStageKey } : row))

    startTransition(async () => {
      try {
        await updateItemStage(itemId, newStageKey)
        toast.success('Stage updated')
      } catch {
        setItems((prev) => prev.map((row) => row.id === itemId ? { ...row, dealStage: item.dealStage } : row))
        toast.error('Failed to update stage')
      }
    })
  }

  function handleStageLabelChange(stageId: string, value: string) {
    setStageLabels((prev) => ({ ...prev, [stageId]: value }))
  }

  function handleStageRename(stageId: string) {
    const label = stageLabels[stageId]?.trim()
    if (!label) { toast.error('Stage label is required'); return }

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
    const previousItems = items
    const stageToDelete = previousStages.find((stage) => stage.id === stageId)
    if (!stageToDelete) return
    const fallbackStage = previousStages.find((stage) => stage.id !== stageId)

    setStages((prev) => prev.filter((stage) => stage.id !== stageId).map((stage, index) => ({ ...stage, position: index })))
    if (fallbackStage) {
      setItems((prev) => prev.map((item) => item.dealStage === stageToDelete.stageKey ? { ...item, dealStage: fallbackStage.stageKey } : item))
    }

    startTransition(async () => {
      try {
        const result = await deletePipelineStage(stageId)
        setItems((prev) => prev.map((item) => item.dealStage === stageToDelete.stageKey ? { ...item, dealStage: result.fallbackStageKey } : item))
        setStageLabels((prev) => { const next = { ...prev }; delete next[stageId]; return next })
        toast.success('Pipeline column removed')
      } catch (error) {
        setStages(previousStages)
        setItems(previousItems)
        toast.error(error instanceof Error ? error.message : 'Failed to remove pipeline column')
      }
    })
  }

  function handleCreateStage() {
    const label = newStageLabel.trim()
    if (!label) { toast.error('Column name is required'); return }

    startTransition(async () => {
      try {
        const created = await createPipelineStage(label, entityType)
        const nextStage: PipelineStage = { ...created, colorClass: getPipelineStageColorClass(created.colorToken) }
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
        <PipelineCardSettings options={fieldOptions} selectedFields={cardFields} onToggle={toggleCardField} onReset={resetCardFields} />
      </div>
      {canManageStages ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-display text-lg font-bold uppercase text-slate-950">Manage pipeline</p>
              <p className="text-xs text-slate-500">Drag cards between stages. Double-click a stage name to rename it.</p>
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <SortableContext items={stages.map((stage) => getStageSortId(stage.id))} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-6 overflow-x-auto pb-6 pt-1 [scrollbar-color:#cbd5e1_transparent]">
            {stageItems.map(({ stage, items: columnItems }) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                items={columnItems}
                activeId={activeId}
                canManageStages={canManageStages}
                stageLabelDraft={stageLabels[stage.id] ?? stage.label}
                onStageLabelChange={handleStageLabelChange}
                onStageRename={handleStageRename}
                onStageDelete={handleStageDelete}
                isSaving={false}
                stages={stages}
                cardFields={cardFields}
                fieldOptions={fieldOptions}
                updateItemStage={updateItemStage}
                onQuickMove={handleQuickMove}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeItem ? (
            <div className="w-64 rotate-1 rounded-lg border border-slate-300 bg-white p-3 shadow-xl opacity-95">
              <p className="text-sm font-semibold text-slate-900">{activeItem.title}</p>
              {activeItem.subtitle ? <p className="mt-1 text-xs text-muted-foreground">{activeItem.subtitle}</p> : null}
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
