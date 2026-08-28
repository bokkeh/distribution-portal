'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, RotateCcw, Settings2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type PipelineCardFieldOption = {
  key: string
  label: string
}

const CHANGE_EVENT = 'crm-pipeline-card-fields-change'

function normalizeFields(raw: string, options: PipelineCardFieldOption[], defaults: string[]) {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return defaults
    const validKeys = new Set(options.map((option) => option.key))
    return parsed.filter((value): value is string => typeof value === 'string' && validKeys.has(value))
  } catch {
    return defaults
  }
}

export function usePipelineCardFields({
  storageKey,
  options,
  defaults,
}: {
  storageKey: string
  options: PipelineCardFieldOption[]
  defaults: string[]
}) {
  const defaultSnapshot = useMemo(() => JSON.stringify(defaults), [defaults])

  const subscribe = useCallback((onStoreChange: () => void) => {
    function handleStorage(event: StorageEvent) {
      if (event.key === storageKey) onStoreChange()
    }

    function handleLocalChange(event: Event) {
      if (event instanceof CustomEvent && event.detail === storageKey) onStoreChange()
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(CHANGE_EVENT, handleLocalChange)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(CHANGE_EVENT, handleLocalChange)
    }
  }, [storageKey])

  const getSnapshot = useCallback(
    () => window.localStorage.getItem(storageKey) ?? defaultSnapshot,
    [defaultSnapshot, storageKey],
  )

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => defaultSnapshot)
  const selectedFields = useMemo(
    () => normalizeFields(snapshot, options, defaults),
    [defaults, options, snapshot],
  )

  const persist = useCallback((nextFields: string[]) => {
    window.localStorage.setItem(storageKey, JSON.stringify(nextFields))
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: storageKey }))
  }, [storageKey])

  const toggleField = useCallback((field: string) => {
    const selected = new Set(selectedFields)
    if (selected.has(field)) selected.delete(field)
    else selected.add(field)
    persist(options.map((option) => option.key).filter((key) => selected.has(key)))
  }, [options, persist, selectedFields])

  const resetFields = useCallback(() => persist(defaults), [defaults, persist])

  return {
    selectedFields: new Set(selectedFields),
    toggleField,
    resetFields,
  }
}

export function PipelineCardSettings({
  options,
  selectedFields,
  onToggle,
  onReset,
}: {
  options: PipelineCardFieldOption[]
  selectedFields: ReadonlySet<string>
  onToggle: (field: string) => void
  onReset: () => void
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2 bg-white" aria-label="Choose pipeline card details">
          <Settings2 className="h-4 w-4" />
          Card details
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-64 rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold text-slate-900">Card details</p>
              <p className="text-xs text-slate-500">Cards resize automatically.</p>
            </div>
            <Popover.Close className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close card details">
              <X className="h-4 w-4" />
            </Popover.Close>
          </div>
          <div className="p-2">
            <div className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-slate-500">
              <span>Name</span>
              <span className="text-xs font-medium uppercase tracking-wide">Always shown</span>
            </div>
            {options.map((option) => {
              const checked = selectedFields.has(option.key)
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onToggle(option.key)}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                  role="checkbox"
                  aria-checked={checked}
                >
                  <span>{option.label}</span>
                  <span className={`flex h-5 w-5 items-center justify-center rounded border ${checked ? 'border-[#ff5a00] bg-[#ff5a00] text-white' : 'border-slate-300 bg-white'}`}>
                    {checked ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="border-t border-slate-100 p-2">
            <button type="button" onClick={onReset} className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
              <RotateCcw className="h-3.5 w-3.5" />
              Restore defaults
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
