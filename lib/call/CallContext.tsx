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
  taggedUsers: Array<{ id: string; name: string; role: string }>
  error: string | null
  drawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  startCall: (phone: string, accountName: string, accountId?: string) => Promise<void>
  endCall: () => void
  toggleMute: () => void
  sendDtmf: (digit: string) => void
  setNotes: (notes: string) => void
  setLinkedAccount: (accountId: string | null, accountName: string | null) => void
  setTaggedUsers: (users: Array<{ id: string; name: string; role: string }>) => void
}

const CallContext = createContext<CallContextType | null>(null)

function getErrorMessage(value: unknown, fallback: string) {
  if (value instanceof Error && value.message) return value.message
  if (typeof value === 'string' && value) return value
  if (value && typeof value === 'object') {
    const event = value as { message?: unknown; error?: unknown }
    if (typeof event.message === 'string' && event.message) return event.message
    if (event.error instanceof Error && event.error.message) return event.error.message
    if (typeof event.error === 'string' && event.error) return event.error
    if (event.error && typeof event.error === 'object') {
      const nestedMessage = (event.error as { message?: unknown }).message
      if (typeof nestedMessage === 'string' && nestedMessage) return nestedMessage
    }
  }
  return fallback
}

interface TelnyxCallNotification {
  state?: string
  remoteStream?: MediaStream
  cause?: string
  causeCode?: number | string
  sipCode?: number
  sipReason?: string
}

function getCallEndedMessage(call: TelnyxCallNotification) {
  const sipCode = typeof call.sipCode === 'number' ? call.sipCode : null
  const sipReason = call.sipReason?.trim()
  const cause = call.cause?.trim()
  const causeCode = call.causeCode == null ? null : String(call.causeCode)
  const detail = [
    sipCode ? `SIP ${sipCode}${sipReason ? ` ${sipReason}` : ''}` : sipReason,
    cause ? `${cause}${causeCode ? ` (${causeCode})` : ''}` : causeCode ? `cause ${causeCode}` : null,
  ].filter(Boolean).join(' · ')

  if (sipCode === 403) {
    return `Telnyx rejected the outbound call. Check the outbound voice profile and caller ID permissions${detail ? ` (${detail})` : ''}.`
  }
  if (sipCode === 404) return `The destination number could not be reached${detail ? ` (${detail})` : ''}.`
  if (sipCode === 486) return `The destination is busy${detail ? ` (${detail})` : ''}.`
  if (sipCode === 408 || sipCode === 480) return `The destination did not answer${detail ? ` (${detail})` : ''}.`
  return `The call ended before it connected${detail ? ` (${detail})` : ''}.`
}

function normalizeUsPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  throw new Error('Enter a valid 10-digit US phone number')
}

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
  const [taggedUsers, setTaggedUsers] = useState<Array<{ id: string; name: string; role: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const openDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const setLinkedAccount = useCallback((nextAccountId: string | null, nextAccountName: string | null) => {
    setAccountId(nextAccountId)
    setAccountName(nextAccountName)
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const notesRef = useRef(notes)
  const taggedUsersRef = useRef(taggedUsers)
  const accountIdRef = useRef(accountId)
  const phoneRef = useRef(phone)
  const accountNameRef = useRef(accountName)
  const reachedActiveRef = useRef(false)
  const endingCallRef = useRef(false)

  // Keep refs in sync so endCall closure has latest values
  useEffect(() => { notesRef.current = notes }, [notes])
  useEffect(() => { taggedUsersRef.current = taggedUsers }, [taggedUsers])
  useEffect(() => { accountIdRef.current = accountId }, [accountId])
  useEffect(() => { phoneRef.current = phone }, [phone])
  useEffect(() => { accountNameRef.current = accountName }, [accountName])

  useEffect(() => {
    audioRef.current = new Audio()
    audioRef.current.autoplay = true
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      try {
        Promise.resolve(clientRef.current?.disconnect()).catch(() => null)
      } catch {}
    }
  }, [])

  const cleanUp = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    try {
      Promise.resolve(clientRef.current?.disconnect()).catch(() => null)
    } catch {}
    callRef.current = null
    clientRef.current = null
    setIsMuted(false)
  }, [])

  const startCall = useCallback(async (p: string, name: string, aId?: string) => {
    cleanUp()
    reachedActiveRef.current = false
    endingCallRef.current = false
    setError(null)
    setPhone(p)
    setAccountName(name)
    setAccountId(aId ?? null)
    setNotes('')
    setTaggedUsers([])
    setCallState('connecting')
    setDrawerOpen(true)

    let readyTimeout: ReturnType<typeof setTimeout> | null = null

    try {
      const destination = normalizeUsPhoneNumber(p)
      const { token, callerNumber } = await getTelnyxWebRtcToken()
      if (!/^\+[1-9]\d{7,14}$/.test(callerNumber)) {
        throw new Error('The Telnyx caller number is not configured correctly')
      }

      const { TelnyxRTC } = await import('@telnyx/webrtc')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = new (TelnyxRTC as any)({ login_token: token })
      clientRef.current = client

      let resolveReady: (() => void) | null = null
      let rejectReady: ((error: Error) => void) | null = null
      const ready = new Promise<void>((resolve, reject) => {
        resolveReady = resolve
        rejectReady = reject
      })

      const failCall = (value: unknown, fallback: string) => {
        const message = getErrorMessage(value, fallback)
        console.error('[telnyx-call] client failure', { message })
        rejectReady?.(new Error(message))
        if (clientRef.current !== client) return
        setError(message)
        setCallState('error')
        cleanUp()
      }

      readyTimeout = setTimeout(() => {
        failCall(new Error('Telnyx did not become ready in time'), 'Call connection timed out')
      }, 15_000)

      client.on('telnyx.notification', (notification: { call?: TelnyxCallNotification }) => {
        if (clientRef.current !== client) return
        const notificationCall = notification?.call
        const cs = notificationCall?.state
        if (!cs) return

        const diagnostics = {
          state: cs,
          cause: notificationCall.cause,
          causeCode: notificationCall.causeCode,
          sipCode: notificationCall.sipCode,
          sipReason: notificationCall.sipReason,
        }
        console.info('[telnyx-call] state changed', diagnostics)

        if (audioRef.current && notificationCall.remoteStream) {
          audioRef.current.srcObject = notificationCall.remoteStream
          audioRef.current.play().catch(() => null)
        }

        if (cs === 'ringing') {
          setCallState('ringing')
        } else if (cs === 'active') {
          reachedActiveRef.current = true
          setCallState('active')
          setDuration(0)
          if (!timerRef.current) {
            timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
          }
        } else if (cs === 'hangup' || cs === 'destroy') {
          const endedBeforeConnecting = !reachedActiveRef.current && !endingCallRef.current
          const endedMessage = endedBeforeConnecting ? getCallEndedMessage(notificationCall) : null
          if (endedMessage) {
            console.error('[telnyx-call] outbound call rejected', { ...diagnostics, message: endedMessage })
          }
          // Save notes on remote hangup
          if (notesRef.current.trim() && accountIdRef.current) {
            saveCallNote(
              accountIdRef.current,
              phoneRef.current ?? '',
              accountNameRef.current ?? '',
              notesRef.current,
              taggedUsersRef.current.map((user) => user.id),
            ).catch(() => null)
          }
          cleanUp()
          setError(endedMessage)
          setCallState(endedMessage ? 'error' : 'idle')
          setDuration(0)
          setNotes('')
          setTaggedUsers([])
        }
      })

      client.on('telnyx.ready', () => {
        if (readyTimeout) clearTimeout(readyTimeout)
        readyTimeout = null
        console.info('[telnyx-call] client ready')
        resolveReady?.()
      })

      client.on('telnyx.error', (event: unknown) => failCall(event, 'Telnyx could not connect the call'))
      client.on('telnyx.rtc.mediaError', (event: unknown) => failCall(event, 'Microphone access failed'))
      client.on('telnyx.rtc.peerConnectionFailureError', (event: unknown) => failCall(event, 'The browser could not establish the audio connection'))
      client.on('telnyx.rtc.peerConnectionSignalingStateClosed', (event: unknown) => {
        if (!reachedActiveRef.current && !endingCallRef.current) {
          failCall(event, 'The audio connection closed before the call connected')
        }
      })

      console.info('[telnyx-call] connecting client')
      await Promise.all([client.connect(), ready])

      if (clientRef.current !== client) return

      const hasMicrophonePermission = await client.checkPermissions(true, false)
      if (!hasMicrophonePermission) {
        throw new Error('Microphone permission is required to place calls')
      }

      const call = client.newCall({
        destinationNumber: destination,
        callerNumber,
        audio: true,
      })
      callRef.current = call
      console.info('[telnyx-call] outbound call created')
    } catch (e) {
      if (readyTimeout) clearTimeout(readyTimeout)
      const message = getErrorMessage(e, 'Failed to start call')
      console.error('[telnyx-call] start failed', { message })
      setError(message)
      setCallState('error')
      cleanUp()
    }
  }, [cleanUp])

  const endCall = useCallback(async () => {
    endingCallRef.current = true
    setCallState('ending')
    try { callRef.current?.hangup() } catch {}

    if (notesRef.current.trim() && accountIdRef.current) {
      await saveCallNote(
        accountIdRef.current,
        phoneRef.current ?? '',
        accountNameRef.current ?? '',
        notesRef.current,
        taggedUsersRef.current.map((user) => user.id),
      ).catch(() => null)
    }

    cleanUp()
    setTimeout(() => {
      setCallState('idle')
      setDuration(0)
      setNotes('')
      setTaggedUsers([])
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
      callState, phone, accountName, accountId, duration, isMuted, notes, taggedUsers, error,
      drawerOpen, openDrawer, closeDrawer,
      startCall, endCall, toggleMute, sendDtmf, setNotes, setLinkedAccount, setTaggedUsers,
    }}>
      {children}
    </CallContext.Provider>
  )
}
