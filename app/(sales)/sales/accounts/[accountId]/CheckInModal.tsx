'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { logVisit } from '@/actions/sales-members'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2, MapPin, X, ClipboardList } from 'lucide-react'

interface Props {
  customerId: string
  salesMemberId: string
  companyName: string
}

export function CheckInModal({ customerId, salesMemberId, companyName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleOpen() {
    setOpen(true)
    setDone(false)
  }

  function handleClose() {
    if (isPending) return
    setOpen(false)
    setNotes('')
  }

  function handleSubmit() {
    startTransition(async () => {
      await logVisit(customerId, salesMemberId, notes.trim() || undefined)
      setDone(true)
      router.refresh()
      setTimeout(() => {
        setOpen(false)
        setNotes('')
      }, 1800)
    })
  }

  return (
    <>
      <Button size="sm" className="w-full" onClick={handleOpen}>
        <MapPin className="w-3.5 h-3.5 mr-2" />
        Check In
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Sheet */}
          <div className="relative z-10 w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Check In</h2>
                <p className="text-sm text-slate-500">{companyName}</p>
              </div>
              <button
                onClick={handleClose}
                disabled={isPending}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {done ? (
              <div className="flex flex-col items-center py-4 gap-2 text-green-700">
                <CheckCircle2 className="w-10 h-10" />
                <p className="font-semibold">Visit logged!</p>
                <p className="text-xs text-slate-500 text-center">Next visit date has been updated.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <ClipboardList className="w-3.5 h-3.5" />
                    Visit Notes <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="What did you discuss? Any follow-ups?"
                    rows={4}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    autoFocus
                  />
                </div>

                <div className="flex gap-2.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleClose}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={handleSubmit}
                    disabled={isPending}
                  >
                    {isPending
                      ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Logging…</>
                      : <><CheckCircle2 className="w-3.5 h-3.5 mr-2" />Log Visit</>
                    }
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
