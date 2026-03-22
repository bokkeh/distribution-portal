'use client'

import { useState, useEffect, useRef } from 'react'
import { Phone, PhoneOff, Loader2, Volume2 } from 'lucide-react'
import { getTelnyxWebRtcToken } from '@/actions/map-contact'

interface Props {
  phone: string
  accountName: string
}

type CallState = 'idle' | 'connecting' | 'ringing' | 'active' | 'ending' | 'error'

export function TelnyxCallButton({ phone, accountName }: Props) {
  const [state, setState] = useState<CallState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
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
  }

  function endCall() {
    setState('ending')
    try { callRef.current?.hangup() } catch {}
    cleanUp()
    setTimeout(() => { setState('idle'); setDuration(0) }, 600)
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
    <div className="rounded-md border border-green-200 bg-green-50 p-2 space-y-1.5">
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
    </div>
  )
}
