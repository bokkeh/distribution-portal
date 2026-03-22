'use client'

import { useState, useEffect, useRef } from 'react'
import { Hash, Phone, PhoneOff, Loader2, Volume2, X } from 'lucide-react'
import { getTelnyxWebRtcToken } from '@/actions/map-contact'

interface Props {
  phone: string
  accountName: string
}

type CallState = 'idle' | 'connecting' | 'ringing' | 'active' | 'ending' | 'error'
const DIAL_PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const

export function TelnyxCallButton({ phone, accountName }: Props) {
  const [state, setState] = useState<CallState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [showDialPad, setShowDialPad] = useState(false)
  const [lastDigits, setLastDigits] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current)
      try { clientRef.current?.disconnect() } catch {}
    }
  }, [])

  async function startCall() {
    setError(null)
    setState('connecting')

    try {
      const { token } = await getTelnyxWebRtcToken()
      const { TelnyxRTC } = await import('@telnyx/webrtc')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = new (TelnyxRTC as any)({ login_token: token })
      clientRef.current = client

      // All call state changes come through the client notification event
      client.on('telnyx.notification', (notification: { call?: { state?: string; remoteStream?: MediaStream } }) => {
        const callState = notification?.call?.state
        if (!callState) return

        // Attach remote stream whenever it's available (ringback + active audio)
        if (audioRef.current && notification.call?.remoteStream) {
          audioRef.current.srcObject = notification.call.remoteStream
          audioRef.current.play().catch(() => null)
        }

        if (callState === 'ringing') {
          setState('ringing')
        } else if (callState === 'active') {
          setState('active')
          setDuration(0)
          timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
        } else if (callState === 'hangup' || callState === 'destroy') {
          cleanUp()
        }
      })

      client.on('telnyx.ready', () => {
        const digits = phone.replace(/\D/g, '')
        // Ensure E.164 format — prepend +1 for 10-digit US numbers
        const destination = digits.startsWith('1') ? `+${digits}` : `+1${digits}`
        const call = client.newCall({
          destinationNumber: destination,
          callerNumber: process.env.NEXT_PUBLIC_TELNYX_FROM_NUMBER ?? '',
        })
        callRef.current = call
      })

      client.on('telnyx.error', (err: { message?: string }) => {
        setError(err?.message ?? 'Call failed')
        setState('error')
        cleanUp()
      })

      client.connect()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start call')
      setState('error')
    }
  }

  function cleanUp() {
    timerRef.current && clearInterval(timerRef.current)
    try { clientRef.current?.disconnect() } catch {}
    callRef.current = null
    clientRef.current = null
    setShowDialPad(false)
    setLastDigits('')
  }

  function endCall() {
    setState('ending')
    try { callRef.current?.hangup() } catch {}
    cleanUp()
    setTimeout(() => { setState('idle'); setDuration(0) }, 600)
  }

  function sendDtmf(digit: string) {
    try {
      callRef.current?.dtmf?.(digit)
      setLastDigits(prev => `${prev}${digit}`.slice(-12))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send keypad tone')
    }
  }

  function fmtDuration(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  if (state === 'idle' || state === 'error') {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={startCall}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-green-50 px-2 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
        >
          <Phone className="h-3 w-3" /> Call
        </button>
        {error && <p className="text-[10px] text-red-500 text-center">{error}</p>}
      </div>
    )
  }

  return (
    <div className="relative rounded-md border border-green-200 bg-green-50 p-2 space-y-1.5">
      <audio ref={audioRef} autoPlay hidden />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {state === 'active'
            ? <Volume2 className="h-3 w-3 shrink-0 text-green-600 animate-pulse" />
            : <Loader2 className="h-3 w-3 shrink-0 text-green-600 animate-spin" />}
          <span className="text-xs font-medium text-green-800 truncate">
            {state === 'connecting' && 'Connecting…'}
            {state === 'ringing' && `Ringing ${accountName}…`}
            {state === 'active' && fmtDuration(duration)}
            {state === 'ending' && 'Ending…'}
          </span>
        </div>
        <button
          type="button"
          onClick={endCall}
          disabled={state === 'ending'}
          className="shrink-0 flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
        >
          <PhoneOff className="h-3 w-3" /> End
        </button>
      </div>
      {(state === 'ringing' || state === 'active') ? (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowDialPad(current => !current)}
            className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-white"
          >
            <Hash className="h-3 w-3" />
            Dial Pad
          </button>
          {lastDigits ? <span className="text-[10px] text-slate-500">Sent: {lastDigits}</span> : null}
        </div>
      ) : null}
      {showDialPad && (state === 'ringing' || state === 'active') ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Keypad</p>
            <button
              type="button"
              onClick={() => setShowDialPad(false)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close dial pad"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {DIAL_PAD_KEYS.map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => sendDtmf(digit)}
                className="flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800 hover:border-blue-300 hover:bg-blue-50"
              >
                {digit}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Send menu digits, star, or pound during the call.</p>
        </div>
      ) : null}
    </div>
  )
}
