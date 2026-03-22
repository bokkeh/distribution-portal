'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getTelnyxWebRtcToken } from '@/actions/map-contact'
import { saveCallNote } from '@/actions/call-notes'

export type CallState = 'idle' | 'connecting' | 'ringing' | 'active' | 'ending' | 'error'

interface CallContextType {
  callState: CallState
  phone: string | null
  accountName: string | null
  accountId: string | null
  duration: number
  isMuted: boolean
  notes: string
  error: string | null
  drawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  startCall: (phone: string, accountName: string, accountId?: string) => void
  endCall: () => void
  toggleMute: () => void
  sendDtmf: (digit: string) => void
  setNotes: (notes: string) => void
}

const CallContext = createContext<CallContextType | null>(null)

export function useCall() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error('useCall must be used within CallProvider')
  return ctx
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [callState, setCallState] = useState<CallState>('idle')
  const [phone, setPhone] = useState<string | null>(null)
  const [accountName, setAccountName] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const openDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const notesRef = useRef(notes)
  const accountIdRef = useRef(accountId)
  const phoneRef = useRef(phone)
  const accountNameRef = useRef(accountName)

  // Keep refs in sync so endCall closure has latest values
  useEffect(() => { notesRef.current = notes }, [notes])
  useEffect(() => { accountIdRef.current = accountId }, [accountId])
  useEffect(() => { phoneRef.current = phone }, [phone])
  useEffect(() => { accountNameRef.current = accountName }, [accountName])

  useEffect(() => {
    audioRef.current = new Audio()
    audioRef.current.autoplay = true
    return () => {
      timerRef.current && clearInterval(timerRef.current)
      try { clientRef.current?.disconnect() } catch {}
    }
  }, [])

  const cleanUp = useCallback(() => {
    timerRef.current && clearInterval(timerRef.current)
    try { clientRef.current?.disconnect() } catch {}
    callRef.current = null
    clientRef.current = null
    setIsMuted(false)
  }, [])

  const startCall = useCallback(async (p: string, name: string, aId?: string) => {
    setError(null)
    setPhone(p)
    setAccountName(name)
    setAccountId(aId ?? null)
    setNotes('')
    setCallState('connecting')
    setDrawerOpen(true)

    try {
      const { token } = await getTelnyxWebRtcToken()
      const { TelnyxRTC } = await import('@telnyx/webrtc')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = new (TelnyxRTC as any)({ login_token: token })
      clientRef.current = client

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.on('telnyx.notification', (notification: { call?: { state?: string; remoteStream?: MediaStream } }) => {
        const cs = notification?.call?.state
        if (!cs) return

        if (audioRef.current && notification.call?.remoteStream) {
          audioRef.current.srcObject = notification.call.remoteStream
          audioRef.current.play().catch(() => null)
        }

        if (cs === 'ringing') {
          setCallState('ringing')
        } else if (cs === 'active') {
          setCallState('active')
          setDuration(0)
          timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
        } else if (cs === 'hangup' || cs === 'destroy') {
          // Save notes on remote hangup
          if (notesRef.current.trim() && accountIdRef.current) {
            saveCallNote(
              accountIdRef.current,
              phoneRef.current ?? '',
              accountNameRef.current ?? '',
              notesRef.current,
            ).catch(() => null)
          }
          cleanUp()
          setCallState('idle')
          setDuration(0)
          setNotes('')
        }
      })

      client.on('telnyx.ready', () => {
        const digits = p.replace(/\D/g, '')
        const destination = digits.startsWith('1') ? `+${digits}` : `+1${digits}`
        const call = client.newCall({
          destinationNumber: destination,
          callerNumber: process.env.NEXT_PUBLIC_TELNYX_FROM_NUMBER ?? '',
        })
        callRef.current = call
      })

      client.on('telnyx.error', (err: { message?: string }) => {
        setError(err?.message ?? 'Call failed')
        setCallState('error')
        cleanUp()
      })

      client.connect()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start call')
      setCallState('error')
    }
  }, [cleanUp])

  const endCall = useCallback(async () => {
    setCallState('ending')
    try { callRef.current?.hangup() } catch {}

    if (notesRef.current.trim() && accountIdRef.current) {
      await saveCallNote(
        accountIdRef.current,
        phoneRef.current ?? '',
        accountNameRef.current ?? '',
        notesRef.current,
      ).catch(() => null)
    }

    cleanUp()
    setTimeout(() => {
      setCallState('idle')
      setDuration(0)
      setNotes('')
    }, 500)
  }, [cleanUp])

  const toggleMute = useCallback(() => {
    try {
      if (isMuted) {
        callRef.current?.unmuteAudio?.()
      } else {
        callRef.current?.muteAudio?.()
      }
      setIsMuted(m => !m)
    } catch {}
  }, [isMuted])

  const sendDtmf = useCallback((digit: string) => {
    try { callRef.current?.dtmf?.(digit) } catch {}
  }, [])

  return (
    <CallContext.Provider value={{
      callState, phone, accountName, accountId, duration, isMuted, notes, error,
      drawerOpen, openDrawer, closeDrawer,
      startCall, endCall, toggleMute, sendDtmf, setNotes,
    }}>
      {children}
    </CallContext.Provider>
  )
}
