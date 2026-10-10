'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''

/** Ensures the Maps JS API + Places library are available, loading them if needed. */
function usePlaces(enabled: boolean) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function init() {
      // Already loaded by a map component — just import the places library
      if (window.google?.maps) {
        if (window.google.maps.places) {
          if (!cancelled) setReady(true)
          return
        }
        try {
          await window.google.maps.importLibrary('places')
          if (!cancelled) setReady(true)
        } catch {
          // importLibrary not supported (old API load) — places still unavailable
        }
        return
      }

      // Maps API not loaded yet — inject script with places
      const existingScript = document.getElementById('__gmaps_places')
      if (!existingScript) {
        const script = document.createElement('script')
        script.id = '__gmaps_places'
        script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places`
        script.async = true
        document.head.appendChild(script)
      }

      // Poll until places is ready
      const poll = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(poll)
          if (!cancelled) setReady(true)
        }
      }, 100)
      setTimeout(() => clearInterval(poll), 15_000)
    }

    init()
    return () => { cancelled = true }
  }, [enabled])

  return ready
}

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  /** name attribute of the city input in the same form */
  cityField?: string
  /** name attribute of the state input in the same form */
  stateField?: string
  /** name attribute of the zip input in the same form */
  zipField?: string
}

/**
 * Drop-in replacement for an address <input> that attaches Google Places
 * Autocomplete. On selection it auto-fills sibling city / state / zip inputs
 * found by their `name` attribute within the same <form>.
 */
export function AddressAutocomplete({
  cityField = 'city',
  stateField = 'state',
  zipField = 'zip',
  className,
  ...inputProps
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const generation = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const active = useRef(false)
  const selecting = useRef(false)
  const detailGeneration = useRef(0)
  const [placesRequested, setPlacesRequested] = useState(false)
  const placesReady = usePlaces(placesRequested && !!MAPS_KEY)
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [highlight, setHighlight] = useState(-1)
  const listId = useId()

  function dismiss() {
    generation.current += 1
    active.current = false
    if (timer.current) clearTimeout(timer.current)
    setSuggestions([])
    setHighlight(-1)
  }

  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) dismiss()
    }
    document.addEventListener('pointerdown', outside)
    return () => {
      document.removeEventListener('pointerdown', outside)
      generation.current += 1
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  function search(value: string) {
    detailGeneration.current += 1
    generation.current += 1
    const version = generation.current
    if (timer.current) clearTimeout(timer.current)
    setSuggestions([]); setHighlight(-1)
    if (!placesReady || value.trim().length < 3 || selecting.current) return
    active.current = true
    timer.current = setTimeout(() => {
      const service = new window.google.maps.places.AutocompleteService()
      service.getPlacePredictions({ input: value, types: ['address'], componentRestrictions: { country: 'us' } }, results => {
        if (generation.current !== version || !active.current) return
        setSuggestions(results ?? [])
      })
    }, 200)
  }

  function setInputValue(el: HTMLInputElement | null, value: string) {
    if (!el) return
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    nativeSetter?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function select(prediction: google.maps.places.AutocompletePrediction) {
    dismiss()
    const version = ++detailGeneration.current
    selecting.current = true
    // Fill immediately; lookup failure still leaves an editable manual address.
    setInputValue(inputRef.current, prediction.description)
    const service = new window.google.maps.places.PlacesService(document.createElement('div'))
    service.getDetails({ placeId: prediction.place_id, fields: ['address_components'] }, place => {
      selecting.current = false
      if (version !== detailGeneration.current || !place?.address_components) return
      const components = place.address_components
      const part = (type: string, short = false) => {
        const component = components.find(item => item.types.includes(type))
        return (short ? component?.short_name : component?.long_name) ?? ''
      }
      const form = inputRef.current?.form
      setInputValue(inputRef.current, [part('street_number'), part('route', true)].filter(Boolean).join(' ') || prediction.description)
      if (form) {
        const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | null
        setInputValue(field(cityField), part('locality') || part('postal_town') || part('sublocality'))
        setInputValue(field(stateField), part('administrative_area_level_1', true))
        setInputValue(field(zipField), part('postal_code'))
      }
      // Programmatic input events must never trigger a fresh search.
      dismiss()
    })
  }

  return <div ref={rootRef} className="relative min-w-0">
    <input
      ref={inputRef}
      autoComplete="off"
      {...inputProps}
      className={cn(className)}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={suggestions.length > 0}
      aria-controls={listId}
      aria-activedescendant={highlight >= 0 ? `${listId}-${highlight}` : undefined}
      onChange={event => {
        if (!event.nativeEvent.isTrusted) return
        selecting.current = false
        search(event.target.value)
      }}
      onFocus={event => { setPlacesRequested(true); inputProps.onFocus?.(event) }}
      onBlur={event => {
        if (!rootRef.current?.contains(event.relatedTarget as Node)) dismiss()
        inputProps.onBlur?.(event)
      }}
      onKeyDown={event => {
        inputProps.onKeyDown?.(event)
        if (event.key === 'Escape') { event.preventDefault(); dismiss() }
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length) {
          event.preventDefault()
          setHighlight(index => event.key === 'ArrowDown' ? (index + 1) % suggestions.length : (index <= 0 ? suggestions.length - 1 : index - 1))
        }
        if (event.key === 'Enter' && highlight >= 0 && suggestions[highlight]) { event.preventDefault(); select(suggestions[highlight]) }
      }}
    />
    {suggestions.length ? <ul id={listId} role="listbox" aria-label="Address suggestions" className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto overscroll-contain rounded-md border bg-white p-1 shadow-lg">
      {suggestions.map((prediction, index) => <li key={prediction.place_id} id={`${listId}-${index}`} role="option" aria-selected={highlight === index}>
        <button type="button" tabIndex={-1} className={cn('min-h-11 w-full rounded px-3 py-2 text-left text-base hover:bg-slate-100', highlight === index && 'bg-slate-100')}
          onPointerDown={event => event.preventDefault()} onClick={() => select(prediction)}>{prediction.description}</button>
      </li>)}
    </ul> : null}
  </div>
}
