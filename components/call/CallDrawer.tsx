'use client'

import { useState } from 'react'
import { Hash, Loader2, Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react'
import { useCall } from '@/lib/call/CallContext'

const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const

function fmtDuration(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

export function CallDrawer() {
  const { callState, phone, accountName, accountId, duration, isMuted, notes, error, endCall, toggleMute, sendDtmf, setNotes } = useCall()
  const [showDialPad, setShowDialPad] = useState(false)

  const isVisible = callState !== 'idle'

  return (
    <div
      className={`fixed right-0 top-0 h-full w-80 bg-white border-l border-slate-200 shadow-2xl z-[100] flex flex-col transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="bg-green-50 border-b border-green-100 p-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            {callState === 'active'
              ? <Volume2 className="h-5 w-5 text-green-600 animate-pulse" />
              : <Loader2 className="h-5 w-5 text-green-600 animate-spin" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">{accountName ?? 'Unknown'}</p>
            <p className="text-xs text-slate-500">{phone}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-medium text-green-700 tabular-nums">
              {callState === 'connecting' && 'Connecting…'}
              {callState === 'ringing' && 'Ringing…'}
              {callState === 'active' && fmtDuration(duration)}
              {callState === 'ending' && 'Ending…'}
              {callState === 'error' && 'Error'}
            </p>
            {accountId && (
              <p className="text-[10px] text-slate-400 mt-0.5">Notes will be saved</p>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 border-b border-slate-100 shrink-0">
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
            onClick={() => setShowDialPad(v => !v)}
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
            className="flex flex-col items-center gap-1.5 rounded-xl bg-red-500 px-2 py-3 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            <PhoneOff className="h-5 w-5" />
            End
          </button>
        </div>
      </div>

      {/* Dial pad */}
      {showDialPad && (
        <div className="p-4 border-b border-slate-100 shrink-0">
          <div className="grid grid-cols-3 gap-2">
            {DIAL_KEYS.map(digit => (
              <button
                key={digit}
                type="button"
                onClick={() => sendDtmf(digit)}
                className="flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-base font-semibold text-slate-800 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                {digit}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="flex-1 flex flex-col p-4 gap-2 overflow-hidden">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 shrink-0">
          Call Notes
          {!accountId && <span className="ml-1 font-normal text-slate-400 normal-case">(no account linked)</span>}
        </p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={accountId
            ? 'Type notes during the call… auto-saved to account when call ends.'
            : 'Type notes during the call…'}
          className="flex-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {accountId && (
          <p className="text-[10px] text-slate-400 shrink-0">
            Saved to account timeline when call ends.
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border-t border-red-100 shrink-0">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
    </div>
  )
}
