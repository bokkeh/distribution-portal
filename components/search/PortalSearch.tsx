'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { Building2, LoaderCircle, ReceiptText, ScanLine, Search, UserRound, Wine } from 'lucide-react'

type SearchResult = {
  id: string
  label: string
  sublabel?: string
  href: string
  type: 'order' | 'account' | 'invoice' | 'tasting' | 'delivery' | 'user'
}

const RESULT_TYPE_LABELS: Record<SearchResult['type'], string> = {
  account: 'Account',
  invoice: 'Invoice',
  tasting: 'Tasting',
  user: 'User',
  order: 'Order',
  delivery: 'Delivery',
}

function ResultIcon({ type }: { type: SearchResult['type'] }) {
  if (type === 'account') return <Building2 className="h-4 w-4" />
  if (type === 'invoice' || type === 'order') return <ReceiptText className="h-4 w-4" />
  if (type === 'tasting') return <Wine className="h-4 w-4" />
  return <UserRound className="h-4 w-4" />
}

export function PortalSearch({ operational = false }: { operational?: boolean }) {
  const router = useRouter()
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 2) {
      setResults([])
      setIsLoading(false)
      setActiveIndex(-1)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
        })
        const nextResults = response.ok ? await response.json() as SearchResult[] : []
        setResults(nextResults)
        setActiveIndex(-1)
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setResults([])
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, 160)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const showResults = isOpen && query.trim().length >= 2

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setIsOpen(false)
      setActiveIndex(-1)
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!results.length) return
      setIsOpen(true)
      setActiveIndex((current) => {
        if (event.key === 'ArrowDown') return current >= results.length - 1 ? 0 : current + 1
        return current <= 0 ? results.length - 1 : current - 1
      })
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (activeIndex < 0 || !results[activeIndex]) return
    event.preventDefault()
    setIsOpen(false)
    router.push(results[activeIndex].href)
  }

  return (
    <div
      ref={containerRef}
      className={operational ? 'relative w-full' : 'relative w-full max-w-xl'}
    >
      <form action="/search" onSubmit={handleSubmit}>
        <Search className={operational
          ? 'pointer-events-none absolute left-4 top-[22px] h-4 w-4 -translate-y-1/2 text-[#ff5a00]'
          : 'pointer-events-none absolute left-3 top-[22px] h-4 w-4 -translate-y-1/2 text-slate-400'} />
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={operational
            ? 'SEARCH ACCOUNTS, ORDERS, DELIVERIES...'
            : 'Search accounts, orders, users, deliveries, tastings, inbox threads...'}
          role="combobox"
          aria-label="Search portal"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showResults}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          autoComplete="off"
          className={operational
            ? 'h-11 w-full rounded-md border border-slate-300 bg-white pl-11 pr-11 font-mono text-sm font-medium uppercase tracking-wide text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#ff5a00] focus:ring-2 focus:ring-orange-500/20'
            : 'h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300'}
        />
        {isLoading ? (
          <LoaderCircle className="pointer-events-none absolute right-4 top-[22px] h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" aria-hidden="true" />
        ) : operational ? (
          <ScanLine className="pointer-events-none absolute right-4 top-[22px] h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        ) : null}
      </form>

      {showResults ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Live search results"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-xl"
        >
          {isLoading && results.length === 0 ? (
            <p className="px-4 py-5 text-sm text-slate-500">Searching…</p>
          ) : results.length ? (
            <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-1.5">
              {results.map((result, index) => (
                <Link
                  key={`${result.type}-${result.id}`}
                  id={`${listboxId}-${index}`}
                  href={result.href}
                  role="option"
                  aria-selected={activeIndex === index}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition ${activeIndex === index ? 'bg-orange-50' : 'hover:bg-slate-50'}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <ResultIcon type={result.type} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold normal-case tracking-normal text-slate-900">{result.label}</span>
                    <span className="block truncate text-xs font-normal normal-case tracking-normal text-slate-500">
                      {RESULT_TYPE_LABELS[result.type]}{result.sublabel ? ` · ${result.sublabel}` : ''}
                    </span>
                  </span>
                </Link>
              ))}
              <Link
                href={`/search?q=${encodeURIComponent(query.trim())}`}
                onClick={() => setIsOpen(false)}
                className="mt-1 block border-t border-slate-100 px-3 py-2.5 text-center text-xs font-semibold normal-case tracking-normal text-orange-700 hover:bg-orange-50"
              >
                View all results for “{query.trim()}”
              </Link>
            </div>
          ) : (
            <div className="px-4 py-5">
              <p className="text-sm font-medium text-slate-800">No results yet</p>
              <p className="mt-1 text-xs text-slate-500">Try a company name, contact, email, city, or record number.</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
