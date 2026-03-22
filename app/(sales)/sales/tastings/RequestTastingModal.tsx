'use client'

import { useState, useTransition } from 'react'
import { Wine, X, CalendarDays, Clock, FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import { requestTastingFromRep } from '@/actions/tastings'

interface Account {
  id: string
  companyName: string
}

export function RequestTastingModal({ accounts }: { accounts: Account[] }) {
  const [open, setOpen] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('14:00')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  function reset() {
    setAccountId('')
    setDate('')
    setTime('14:00')
    setNotes('')
    setStatus('idle')
    setErrorMsg('')
  }

  function handleClose() {
    reset()
    setOpen(false)
  }

  function handleSubmit() {
    if (!accountId || !date || !time) return
    startTransition(async () => {
      const result = await requestTastingFromRep({ accountId, preferredDate: date, preferredTime: time, notes })
      if (result?.error) {
        setStatus('error')
        setErrorMsg(result.error)
      } else {
        setStatus('success')
        setTimeout(() => handleClose(), 2000)
      }
    })
  }

  // Min date = tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().slice(0, 10)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm font-semibold transition-colors"
      >
        <Wine className="w-4 h-4" />
        Request a Tasting
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-50">
                  <Wine className="w-4 h-4 text-violet-600" />
                </div>
                <span className="font-semibold text-slate-900">Request a Tasting</span>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Account */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Store / Account</label>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100 transition"
                >
                  <option value="">Select an account…</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.companyName}</option>
                  ))}
                </select>
              </div>

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    <CalendarDays className="w-3 h-3 inline mr-1" />Preferred Date
                  </label>
                  <input
                    type="date"
                    min={minDate}
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    <Clock className="w-3 h-3 inline mr-1" />Preferred Time
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100 transition"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  <FileText className="w-3 h-3 inline mr-1" />Notes <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any details for the admin — products to feature, store contact, etc."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100 transition resize-none"
                />
              </div>

              {/* Status */}
              {status === 'success' && (
                <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2.5 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Request submitted! Admin has been notified.
                </div>
              )}
              {status === 'error' && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2.5 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!accountId || !date || !time || isPending || status === 'success'}
                className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                {isPending ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
