'use client'

import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

const AGE_GATE_COOKIE = 'ahawc_age_verified'
const AGE_GATE_STORAGE = 'ahawc-age-verified'
const GATED_PATHS = new Set(['/', '/login', '/privacy', '/terms'])

function hasVerification() {
  if (typeof document === 'undefined') return false
  return document.cookie.includes(`${AGE_GATE_COOKIE}=true`) || window.localStorage.getItem(AGE_GATE_STORAGE) === 'true'
}

function setVerification() {
  const maxAge = 60 * 60 * 24 * 365
  document.cookie = `${AGE_GATE_COOKIE}=true; Max-Age=${maxAge}; Path=/; SameSite=Lax`
  window.localStorage.setItem(AGE_GATE_STORAGE, 'true')
}

function isTwentyOneOrOlder(month: string, day: string, year: string) {
  const monthNum = Number(month)
  const dayNum = Number(day)
  const yearNum = Number(year)
  if (!Number.isInteger(monthNum) || !Number.isInteger(dayNum) || !Number.isInteger(yearNum)) return false
  const birthDate = new Date(yearNum, monthNum - 1, dayNum)
  if (
    birthDate.getFullYear() !== yearNum ||
    birthDate.getMonth() !== monthNum - 1 ||
    birthDate.getDate() !== dayNum
  ) {
    return false
  }

  const today = new Date()
  const cutoff = new Date(today.getFullYear() - 21, today.getMonth(), today.getDate())
  return birthDate <= cutoff
}

function toInputDateValue(month: string, day: string, year: string) {
  if (!month || !day || !year) return ''
  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function fromInputDateValue(value: string) {
  const [year = '', month = '', day = ''] = value.split('-')
  return { month, day, year }
}

export function PublicAgeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isGated = useMemo(() => GATED_PATHS.has(pathname), [pathname])
  const [sessionVerified, setSessionVerified] = useState(false)
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [year, setYear] = useState('')
  const [error, setError] = useState('')
  const verified = !isGated || sessionVerified || hasVerification()

  if (verified) {
    return <>{children}</>
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isTwentyOneOrOlder(month, day, year)) {
      setError('You must be 21 or older to enter this site.')
      return
    }

    setVerification()
    setError('')
    setSessionVerified(true)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="pointer-events-none invisible h-0 overflow-hidden" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_35%),linear-gradient(180deg,_#08111f_0%,_#111827_100%)]" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/95 p-8 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-600">Age Verification</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">You must be 21+ to enter</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            AHAWC distributes alcohol beverages. Enter your date of birth to confirm you are at least 21 years old before viewing this site.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <label className="block space-y-1.5 text-sm text-slate-700">
              <span>Date of birth</span>
              <input
                type="date"
                value={toInputDateValue(month, day, year)}
                onChange={event => {
                  const next = fromInputDateValue(event.target.value)
                  setMonth(next.month)
                  setDay(next.day)
                  setYear(next.year)
                }}
                autoComplete="bday"
                max={new Date().toISOString().split('T')[0]}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-amber-500"
              />
            </label>

            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

            <button
              type="submit"
              className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
            >
              Enter Site
            </button>
          </form>

          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            By entering, you confirm you are at least 21 years old and legally permitted to view alcoholic beverage products in your jurisdiction.
          </p>
        </div>
      </div>
    </div>
  )
}
