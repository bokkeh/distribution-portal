'use client'

import { RefObject, useEffect, useMemo, useState } from 'react'

type DraftStatus = 'idle' | 'saved' | 'restored'

function serializeForm(form: HTMLFormElement) {
  const values: Record<string, string | boolean> = {}
  const elements = Array.from(form.elements) as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>

  for (const element of elements) {
    const name = element.name
    if (!name || element instanceof HTMLButtonElement) continue

    if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
      values[name] = element.checked
      continue
    }

    values[name] = element.value
  }

  return values
}

function restoreForm(form: HTMLFormElement, draft: Record<string, string | boolean>) {
  const elements = Array.from(form.elements) as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>

  for (const element of elements) {
    const name = element.name
    if (!name || !(name in draft)) continue
    const value = draft[name]

    if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
      element.checked = Boolean(value)
      continue
    }

    element.value = typeof value === 'string' ? value : value ? 'true' : ''
  }
}

export function useFormDraftAutosave(formRef: RefObject<HTMLFormElement | null>, storageKey: string) {
  const [status, setStatus] = useState<DraftStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  useEffect(() => {
    const form = formRef.current
    if (!form) return

    const raw = window.localStorage.getItem(storageKey)
    if (raw) {
      try {
        restoreForm(form, JSON.parse(raw) as Record<string, string | boolean>)
        setStatus('restored')
      } catch {
        window.localStorage.removeItem(storageKey)
      }
    }

    let timeoutId: number | null = null
    const saveDraft = () => {
      if (timeoutId) window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(serializeForm(form)))
          setStatus('saved')
          setLastSavedAt(new Date())
        } catch {}
      }, 450)
    }

    form.addEventListener('input', saveDraft)
    form.addEventListener('change', saveDraft)

    return () => {
      form.removeEventListener('input', saveDraft)
      form.removeEventListener('change', saveDraft)
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [formRef, storageKey])

  const statusText = useMemo(() => {
    if (status === 'restored') return 'Draft restored'
    if (status === 'saved' && lastSavedAt) return `Draft saved ${lastSavedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    return ''
  }, [lastSavedAt, status])

  function clearDraft() {
    window.localStorage.removeItem(storageKey)
    setStatus('idle')
    setLastSavedAt(null)
  }

  return { status, statusText, clearDraft }
}
