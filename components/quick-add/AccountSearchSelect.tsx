'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Building2, Loader2, Plus, Search } from 'lucide-react'
import { quickCreateAccount } from '@/actions/quick-add'

export type QuickAccount = {
  id: string
  companyName: string
  address?: string | null
  city?: string | null
  state?: string | null
  contactName?: string | null
}

export function AccountSearchSelect({ value, onChange, initialAccountId, optional = false }: {
  value: QuickAccount | null
  onChange: (account: QuickAccount | null) => void
  initialAccountId?: string | null
  optional?: boolean
}) {
  const [query, setQuery] = useState(value?.companyName ?? '')
  const [results, setResults] = useState<QuickAccount[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedInitial = useRef<string | null>(null)
  const listboxId = useId()

  useEffect(() => {
    if (!initialAccountId || value || loadedInitial.current === initialAccountId) return
    loadedInitial.current = initialAccountId
    fetch(`/api/quick-add/options?scope=accounts&id=${encodeURIComponent(initialAccountId)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load account')))
      .then((data: { accounts?: QuickAccount[] }) => {
        const account = data.accounts?.[0]
        if (account) {
          onChange(account)
          setQuery(account.companyName)
        }
      })
      .catch(() => null)
  }, [initialAccountId, onChange, value])

  useEffect(() => {
    const term = query.trim()
    if (value && term === value.companyName) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/quick-add/options?scope=accounts&q=${encodeURIComponent(term)}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Account search failed')
        const data = await response.json() as { accounts?: QuickAccount[] }
        setResults(data.accounts ?? [])
      } catch (searchError) {
        if ((searchError as Error).name !== 'AbortError') setError('Unable to search accounts.')
      } finally {
        setLoading(false)
      }
    }, 220)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, value])

  async function createInline() {
    const companyName = query.trim()
    if (!companyName || creating) return
    setCreating(true)
    setError(null)
    const result = await quickCreateAccount({ companyName })
    if (result.error) setError(result.error)
    else if (result.account) {
      onChange(result.account)
      setQuery(result.account.companyName)
      setOpen(false)
    }
    setCreating(false)
  }

  return (
    <div className="relative">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Account{optional ? ' (optional)' : ''}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            if (value && event.target.value !== value.companyName) onChange(null)
            setOpen(true)
          }}
          placeholder="Search account, city, contact…"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        {loading ? <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-slate-400" /> : null}
      </div>
      {open ? (
        <div id={listboxId} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          {results.map((account) => (
            <button
              key={account.id}
              type="button"
              role="option"
              aria-selected={value?.id === account.id}
              onClick={() => { onChange(account); setQuery(account.companyName); setOpen(false) }}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
            >
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span><span className="block text-sm font-medium text-slate-900">{account.companyName}</span><span className="block text-xs text-slate-500">{[account.address, account.city, account.state].filter(Boolean).join(', ') || account.contactName || 'No location on file'}</span></span>
            </button>
          ))}
          {query.trim() && !results.some((account) => account.companyName.toLowerCase() === query.trim().toLowerCase()) ? (
            <button type="button" onClick={createInline} disabled={creating} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create “{query.trim()}”
            </button>
          ) : null}
          {!loading && !results.length && !query.trim() ? <p className="px-3 py-3 text-sm text-slate-500">Start typing to find an account.</p> : null}
        </div>
      ) : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
