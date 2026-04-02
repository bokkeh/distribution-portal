'use client'

import { useEffect, useState, useTransition } from 'react'
import { Hash, Link2, Loader2, Mic, MicOff, Phone, PhoneOff, Search, Volume2, X } from 'lucide-react'
import { searchAccountsForCallLink } from '@/actions/call-notes'
import { useCall } from '@/lib/call/CallContext'

const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const

function fmtDuration(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

export function CallDrawer() {
  const {
    callState,
    phone,
    accountName,
    accountId,
    duration,
    isMuted,
    notes,
    error,
    drawerOpen,
    openDrawer,
    closeDrawer,
    endCall,
    toggleMute,
    sendDtmf,
    setNotes,
    setLinkedAccount,
  } = useCall()
  const [showDialPad, setShowDialPad] = useState(false)
  const [linkQuery, setLinkQuery] = useState('')
  const [accountOptions, setAccountOptions] = useState<Array<{
    id: string
    companyName: string
    phone: string | null
    businessPhone: string | null
    pocPhone: string | null
    city: string | null
    state: string | null
  }>>([])
  const [isSearching, startSearchTransition] = useTransition()

  const isActive = callState !== 'idle' && callState !== 'error'
  const headerBg = isActive ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-200'

  useEffect(() => {
    if (!drawerOpen || !phone) return
    startSearchTransition(async () => {
      const results = await searchAccountsForCallLink({ phone, query: linkQuery })
      setAccountOptions(results)
    })
  }, [drawerOpen, phone, linkQuery])

  return (
    <>
      {!drawerOpen && phone && (
        <button
          type="button"
          onClick={openDrawer}
          className="fixed right-0 top-1/2 z-[100] flex -translate-y-1/2 items-center gap-1.5 rounded-l-lg bg-slate-800 px-2 py-3 text-xs font-medium text-white shadow-lg transition-colors hover:bg-slate-700"
          title="Reopen call panel"
        >
          <Phone className="h-3.5 w-3.5" />
          <span className="[writing-mode:vertical-rl] text-[10px] tracking-wide">CALL</span>
        </button>
      )}

      <div
        className={`fixed right-0 top-0 z-[100] flex h-full w-80 flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className={`shrink-0 border-b p-4 ${headerBg}`}>
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              {callState === 'active'
                ? <Volume2 className="h-5 w-5 animate-pulse text-green-600" />
                : isActive
                  ? <Loader2 className="h-5 w-5 animate-spin text-green-600" />
                  : <Phone className="h-5 w-5 text-slate-400" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{accountName ?? 'Unknown'}</p>
              <p className="text-xs text-slate-500">{phone}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="text-right">
                <p className="tabular-nums text-xs font-medium text-green-700">
                  {callState === 'connecting' && 'Connecting...'}
                  {callState === 'ringing' && 'Ringing...'}
                  {callState === 'active' && fmtDuration(duration)}
                  {callState === 'ending' && 'Ending...'}
                  {(callState === 'idle' || callState === 'error') && 'Call ended'}
                </p>
                {accountId && isActive ? (
                  <p className="mt-0.5 text-[10px] text-slate-400">Notes will be saved</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                title="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {isActive ? (
          <div className="shrink-0 border-b border-slate-100 p-4">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={toggleMute}
                disabled={callState !== 'active'}
                className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition-colors disabled:opacity-40 ${
                  isMuted
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </button>

              <button
                type="button"
                onClick={() => setShowDialPad((v) => !v)}
                className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition-colors ${
                  showDialPad
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Hash className="h-5 w-5" />
                Keypad
              </button>

              <button
                type="button"
                onClick={endCall}
                disabled={callState === 'ending'}
                className="flex flex-col items-center gap-1.5 rounded-xl bg-red-500 px-2 py-3 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                <PhoneOff className="h-5 w-5" />
                End
              </button>
            </div>
          </div>
        ) : null}

        {isActive && showDialPad ? (
          <div className="shrink-0 border-b border-slate-100 p-4">
            <div className="grid grid-cols-3 gap-2">
              {DIAL_KEYS.map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => sendDtmf(digit)}
                  className="flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-base font-semibold text-slate-800 transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  {digit}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-1 flex-col gap-2 overflow-hidden p-4">
          <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-slate-400" />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Linked Account</p>
            </div>
            {accountId ? (
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{accountName}</p>
                  <p className="text-xs text-slate-500">Call notes will save to this CRM account.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLinkedAccount(null, null)
                    setLinkQuery('')
                  }}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="mt-2 space-y-3">
                <p className="text-xs text-amber-700">No account linked yet. Pick one below so your call notes save to the right record.</p>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={linkQuery}
                    onChange={(e) => setLinkQuery(e.target.value)}
                    placeholder="Search account name"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                  />
                </div>
                <div className="max-h-32 space-y-2 overflow-y-auto">
                  {isSearching ? (
                    <p className="text-xs text-slate-500">Searching accounts...</p>
                  ) : accountOptions.length === 0 ? (
                    <p className="text-xs text-slate-500">No account match found for this number yet. Search by company name if needed.</p>
                  ) : (
                    accountOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setLinkedAccount(option.id, option.companyName)}
                        className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-blue-300 hover:bg-blue-50"
                      >
                        <p className="text-sm font-medium text-slate-900">{option.companyName}</p>
                        <p className="text-xs text-slate-500">
                          {[option.city, option.state].filter(Boolean).join(', ') || option.phone || option.businessPhone || option.pocPhone || 'No location info'}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Call Notes</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              accountId
                ? 'Type notes during the call... auto-saved to the linked account when the call ends.'
                : 'Type notes during the call... link an account above before ending the call to save them to CRM.'
            }
            className="flex-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <p className="shrink-0 text-[10px] text-slate-400">
            {accountId
              ? (isActive ? 'Saved to the linked account timeline when the call ends.' : 'Notes saved to the linked account timeline.')
              : 'Notes will not attach to CRM until an account is linked.'}
          </p>
        </div>

        {error ? (
          <div className="shrink-0 border-t border-red-100 bg-red-50 p-3">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        ) : null}
      </div>
    </>
  )
}
