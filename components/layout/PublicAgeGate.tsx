'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
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

export function PublicAgeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isGated = useMemo(() => GATED_PATHS.has(pathname), [pathname])
  const [mounted, setMounted] = useState(false)
  const [storedVerified, setStoredVerified] = useState(false)
  const [sessionVerified, setSessionVerified] = useState(false)
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [year, setYear] = useState('')
  const [error, setError] = useState('')
  const currentYear = new Date().getFullYear()
  const months = useMemo(
    () => [
      { value: '01', label: 'January' },
      { value: '02', label: 'February' },
      { value: '03', label: 'March' },
      { value: '04', label: 'April' },
      { value: '05', label: 'May' },
      { value: '06', label: 'June' },
      { value: '07', label: 'July' },
      { value: '08', label: 'August' },
      { value: '09', label: 'September' },
      { value: '10', label: 'October' },
      { value: '11', label: 'November' },
      { value: '12', label: 'December' },
    ],
    [],
  )
  const years = useMemo(
    () => Array.from({ length: 100 }, (_, index) => String(currentYear - 21 - index)),
    [currentYear],
  )
  const dayCount = useMemo(() => {
    const monthNum = Number(month)
    const yearNum = Number(year)
    if (!monthNum) return 31
    if (!yearNum) return new Date(currentYear, monthNum, 0).getDate()
    return new Date(yearNum, monthNum, 0).getDate()
  }, [currentYear, month, year])
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, index) => String(index + 1).padStart(2, '0')),
    [dayCount],
  )
  const verified = !isGated || sessionVerified || (mounted && storedVerified)

  useEffect(() => {
    setMounted(true)
    setStoredVerified(hasVerification())
  }, [])

  useEffect(() => {
    if (day && Number(day) > dayCount) {
      setDay('')
    }
  }, [day, dayCount])

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
          <div className="mb-5 flex justify-center">
            <Image
              src="/brand/logo.png"
              alt="AHAWC"
              width={72}
              height={72}
              className="h-[72px] w-[72px] object-contain"
              priority
            />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-600">Age Verification</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">You must be 21+ to enter</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            AHAWC distributes alcohol beverages. Enter your date of birth to confirm you are at least 21 years old before viewing this site.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <label className="block space-y-1.5 text-sm text-slate-700">
              <span>Date of birth</span>
              <div className="grid gap-3 sm:grid-cols-[1.25fr_0.9fr_1fr]">
                <select
                  value={month}
                  onChange={event => {
                    setMonth(event.target.value)
                    setError('')
                  }}
                  autoComplete="bday-month"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-amber-500"
                >
                  <option value="">Month</option>
                  {months.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={day}
                  onChange={event => {
                    setDay(event.target.value)
                    setError('')
                  }}
                  autoComplete="bday-day"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-amber-500"
                >
                  <option value="">Day</option>
                  {days.map(option => (
                    <option key={option} value={option}>
                      {Number(option)}
                    </option>
                  ))}
                </select>
                <select
                  value={year}
                  onChange={event => {
                    setYear(event.target.value)
                    setError('')
                  }}
                  autoComplete="bday-year"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-amber-500"
                >
                  <option value="">Year</option>
                  {years.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

            <button
              type="submit"
              className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
            >
              Enter Site
            </button>
            <a
              href="https://www.responsibility.org/"
              target="_blank"
              rel="noreferrer"
              className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              I am under 21
            </a>
          </form>

          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            By entering, you confirm you are at least 21 years old and legally permitted to view alcoholic beverage products in your jurisdiction.
          </p>
        </div>
      </div>
    </div>
  )
}
