'use client'

import { useEffect, useRef } from 'react'
import { useJsApiLoader } from '@react-google-maps/api'
import { cn } from '@/lib/utils'

// Stable reference — must not be recreated on each render
const LIBRARIES: ('places')[] = ['places']

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
 * Autocomplete. On selection it also fills sibling city / state / zip inputs
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

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '',
    libraries: LIBRARIES,
  })

  useEffect(() => {
    if (!isLoaded || !inputRef.current || acRef.current) return

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
  }, [isLoaded, cityField, stateField, zipField])

  return (
    <input
      ref={inputRef}
      autoComplete="off"
      className={cn(className)}
      {...inputProps}
    />
  )
}
