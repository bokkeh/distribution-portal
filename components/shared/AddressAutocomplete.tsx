'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''

/** Ensures the Maps JS API + Places library are available, loading them if needed. */
function usePlaces() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
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
  }, [])

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
  const acRef = useRef<google.maps.places.Autocomplete | null>(null)
  const placesReady = usePlaces()

  useEffect(() => {
    if (!placesReady || !inputRef.current || acRef.current) return

    acRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'us' },
      fields: ['address_components'],
    })

    acRef.current.addListener('place_changed', () => {
      const place = acRef.current!.getPlace()
      if (!place.address_components) return

      let streetNumber = ''
      let route = ''
      let city = ''
      let state = ''
      let zip = ''

      for (const comp of place.address_components) {
        if (comp.types.includes('street_number')) streetNumber = comp.long_name
        if (comp.types.includes('route')) route = comp.short_name
        if (comp.types.includes('locality')) city = comp.long_name
        if (comp.types.includes('administrative_area_level_1')) state = comp.short_name
        if (comp.types.includes('postal_code')) zip = comp.long_name
      }

      const street = [streetNumber, route].filter(Boolean).join(' ')
      const form = inputRef.current?.form

      function setInputValue(el: HTMLInputElement | null, value: string) {
        if (!el) return
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        nativeSetter?.call(el, value)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }

      setInputValue(inputRef.current, street)

      if (form) {
        setInputValue(form.querySelector<HTMLInputElement>(`[name="${cityField}"]`), city)
        setInputValue(form.querySelector<HTMLInputElement>(`[name="${stateField}"]`), state)
        setInputValue(form.querySelector<HTMLInputElement>(`[name="${zipField}"]`), zip)
      }
    })

    return () => {
      if (acRef.current) {
        window.google.maps.event.clearInstanceListeners(acRef.current)
        acRef.current = null
      }
    }
  }, [placesReady, cityField, stateField, zipField])

  return (
    <input
      ref={inputRef}
      autoComplete="off"
      className={cn(className)}
      {...inputProps}
    />
  )
}
