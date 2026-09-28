'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { upsertRankRequirement, deleteRankRequirement } from '@/actions/progression'
import { RANKS, REQUIREMENT_DEFS, getRequirementDef, isCustomRequirementKey } from '@/lib/progression/ranks'
import type { RequirementRow } from '@/lib/progression/data'
import type { ProgressionRequirementType } from '@/db/schema'
import { Trash2, Plus } from 'lucide-react'

const TYPE_OPTIONS: ProgressionRequirementType[] = ['required', 'recommended', 'optional', 'not_applicable']

export function RequirementsEditor({ requirements }: { requirements: RequirementRow[] }) {
  const [activeLevel, setActiveLevel] = useState(2)
  const forLevel = requirements.filter(r => r.level === activeLevel && !r.market)
  const usedKeys = new Set(forLevel.map(r => r.key))
  const availableStandardKeys = REQUIREMENT_DEFS.filter(d => !usedKeys.has(d.key))

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {RANKS.filter(r => r.level > 1).map(r => (
          <button
            key={r.level}
            onClick={() => setActiveLevel(r.level)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${activeLevel === r.level ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            L{r.level} · {r.name}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {forLevel.length === 0 && <p className="text-sm text-slate-400">No requirements configured for this rank yet. Add one below.</p>}
        {forLevel.map(req => <RequirementEditorRow key={req.id} req={req} />)}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        {availableStandardKeys.length > 0 && (
          <AddStandardRequirement level={activeLevel} options={availableStandardKeys} />
        )}
        <AddCustomRequirement level={activeLevel} />
      </div>
    </div>
  )
}

function RequirementEditorRow({ req }: { req: RequirementRow }) {
  const [label, setLabel] = useState(req.label)
  const [type, setType] = useState<ProgressionRequirementType>(req.requirementType)
  const [target, setTarget] = useState(req.targetNumeric != null ? String(req.targetNumeric) : '')
  const [notes, setNotes] = useState(req.notes ?? '')
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const def = getRequirementDef(req.key)
  const isCustom = isCustomRequirementKey(req.key)

  function save() {
    startTransition(async () => {
      await upsertRankRequirement({
        id: req.id,
        level: req.level,
        market: req.market,
        key: req.key,
        label,
        requirementType: type,
        targetNumeric: req.isQualitative ? null : (target ? Number(target) : null),
        isQualitative: req.isQualitative,
        notes,
        sortOrder: req.sortOrder,
      })
      router.refresh()
    })
  }

  function remove() {
    startTransition(async () => {
      await deleteRankRequirement(req.id)
      router.refresh()
    })
  }

  return (
    <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[2fr_1fr_0.8fr_1.5fr_auto] sm:items-center">
      <input value={label} onChange={e => setLabel(e.target.value)} onBlur={save} disabled={!isCustom} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-500" />
      <select value={type} onChange={e => { setType(e.target.value as ProgressionRequirementType); }} onBlur={save} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm">
        {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
      </select>
      {!req.isQualitative ? (
        <input value={target} onChange={e => setTarget(e.target.value)} onBlur={save} placeholder={def?.unit ?? 'target'} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" />
      ) : (
        <span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-center text-xs text-slate-400">Manual / qualitative</span>
      )}
      <input value={notes} onChange={e => setNotes(e.target.value)} onBlur={save} placeholder="Notes" className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" />
      <button onClick={remove} disabled={pending} className="justify-self-end rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function AddStandardRequirement({ level, options }: { level: number; options: typeof REQUIREMENT_DEFS }) {
  const [key, setKey] = useState(options[0]?.key ?? '')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function add() {
    const def = getRequirementDef(key)
    if (!def) return
    startTransition(async () => {
      await upsertRankRequirement({ level, key: def.key, label: def.label, requirementType: 'required', targetNumeric: def.computed ? 0 : null, isQualitative: !def.computed })
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      <select value={key} onChange={e => setKey(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm">
        {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <Button size="sm" variant="outline" disabled={pending} onClick={add}><Plus className="mr-1 h-3.5 w-3.5" />Add standard requirement</Button>
    </div>
  )
}

function AddCustomRequirement({ level }: { level: number }) {
  const [label, setLabel] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function add() {
    if (!label.trim()) return
    const slug = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)
    startTransition(async () => {
      await upsertRankRequirement({ level, key: `custom:${slug}_${Date.now()}`, label: label.trim(), requirementType: 'required', isQualitative: true })
      setLabel('')
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Custom qualitative requirement (e.g. Retailer relationship strength)" className="w-64 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" />
      <Button size="sm" variant="outline" disabled={pending || !label.trim()} onClick={add}><Plus className="mr-1 h-3.5 w-3.5" />Add custom</Button>
    </div>
  )
}
