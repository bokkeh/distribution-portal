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
  const clientRef = useRef<any>(null)
  const callRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current)
      clientRef.current?.disconnect()
    }
  }, [])

  async function startCall() {
    setError(null)
    setState('connecting')

    try {
      const { token } = await getTelnyxWebRtcToken()
      const { TelnyxRTC } = await import('@telnyx/webrtc')

      const client = new TelnyxRTC({ login_token: token })
      clientRef.current = client

      client.on('telnyx.ready', () => {
        const destination = phone.replace(/\D/g, '')
        const call = client.newCall({
          destinationNumber: destination,
          callerNumber: process.env.NEXT_PUBLIC_TELNYX_FROM_NUMBER ?? '',
        })
        callRef.current = call

        call.on('telnyx.notification', (notification: any) => {
          const callState = notification?.call?.state
          if (callState === 'ringing') setState('ringing')
          if (callState === 'active') {
            setState('active')
            setDuration(0)
            timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
            // Attach remote audio
            if (audioRef.current) {
              audioRef.current.srcObject = call.remoteStream
              audioRef.current.play().catch(() => null)
            }
          }
          if (callState === 'hangup' || callState === 'destroy') {
            endCall()
          }
        })
      })

      client.on('telnyx.error', (err: any) => {
        setError(err?.message ?? 'Call failed')
        setState('error')
        clientRef.current?.disconnect()
      })

      client.connect()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start call')
      setState('error')
    }
  }

  function endCall() {
    setState('ending')
    timerRef.current && clearInterval(timerRef.current)
    try { callRef.current?.hangup() } catch {}
    try { clientRef.current?.disconnect() } catch {}
    callRef.current = null
    clientRef.current = null
    setTimeout(() => { setState('idle'); setDuration(0) }, 800)
  }

  function fmt(s: number) {
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
          <Phone className="h-3 w-3" />
          Call
        </button>
        {error && <p className="text-[10px] text-red-500 text-center">{error}</p>}
      </div>
    )
  }

  return (
    <div className="rounded-md border border-green-200 bg-green-50 p-2 space-y-1.5">
      <audio ref={audioRef} autoPlay hidden />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {state === 'active'
            ? <Volume2 className="h-3 w-3 text-green-600 animate-pulse" />
            : <Loader2 className="h-3 w-3 text-green-600 animate-spin" />}
          <span className="text-xs font-medium text-green-800">
            {state === 'connecting' && 'Connecting…'}
            {state === 'ringing' && `Calling ${accountName}…`}
            {state === 'active' && fmt(duration)}
            {state === 'ending' && 'Ending…'}
          </span>
        </div>
        <button
          type="button"
          onClick={endCall}
          disabled={state === 'ending'}
          className="flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
        >
          <PhoneOff className="h-3 w-3" /> End
        </button>
      </div>
    </div>
  )
}
