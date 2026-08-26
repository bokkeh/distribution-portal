'use client'

import { useState, useTransition } from 'react'
import { Phone, X, Delete, Send, CheckCircle2, AlertCircle, MessageSquare, PhoneCall, PhoneOff } from 'lucide-react'
import { sendDirectSms, initiateCall } from '@/actions/notifications'
import { cn } from '@/lib/utils'

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
]

type Tab = 'sms' | 'call'
type CallStatus = 'idle' | 'calling' | 'connected' | 'ended' | 'error'

export function DialpadButton({ onClick, dark = false }: { onClick: () => void; dark?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative rounded-xl px-2 py-2 transition-colors',
        dark ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
      )}
      aria-label="Open dialpad"
    >
      <Phone className="w-5 h-5" />
    </button>
  )
}

export function DialpadSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('sms')
  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [smsStatus, setSmsStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  function press(key: string) {
    setNumber(prev => prev + key)
  }

  function backspace() {
    setNumber(prev => prev.slice(0, -1))
  }

  function resetAll() {
    setNumber('')
    setName('')
    setMessage('')
    setSmsStatus('idle')
    setCallStatus('idle')
    setErrorMsg('')
  }

  function handleSendSms() {
    if (!number.trim() || !message.trim()) return
    startTransition(async () => {
      const result = await sendDirectSms(number.trim(), name.trim(), message.trim())
      if (result?.error) {
        setSmsStatus('error')
        setErrorMsg(result.error)
      } else {
        setSmsStatus('success')
        setTimeout(() => { setMessage(''); setSmsStatus('idle') }, 2500)
      }
    })
  }

  function handleCall() {
    if (!number.trim()) return
    setCallStatus('calling')
    setErrorMsg('')
    startTransition(async () => {
      const result = await initiateCall(number.trim(), name.trim())
      if (result?.error) {
        setCallStatus('error')
        setErrorMsg(result.error)
      } else {
        setCallStatus('connected')
      }
    })
  }

  function handleHangup() {
    setCallStatus('ended')
    setTimeout(() => setCallStatus('idle'), 2000)
  }

  const displayNumber = number
    .replace(/\D/g, '')
    .replace(/^1?(\d{0,3})(\d{0,3})(\d{0,4}).*/, (_, a, b, c) =>
      [a, b && `-${b}`, c && `-${c}`].filter(Boolean).join('')
    )

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <div className={cn(
        'fixed top-0 right-0 h-full w-80 bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out',
        open ? 'translate-x-0' : 'translate-x-full'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50">
              <Phone className="w-4 h-4 text-blue-600" />
            </div>
            <span className="font-semibold text-slate-900 text-sm">Dialpad</span>
          </div>
          <button
            onClick={() => { resetAll(); onClose() }}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex mx-4 mt-4 rounded-xl bg-slate-100 p-1 gap-1">
          {([
            { id: 'sms', label: 'SMS', icon: MessageSquare },
            { id: 'call', label: 'Voice Call', icon: PhoneCall },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setTab(id); setSmsStatus('idle'); setCallStatus('idle'); setErrorMsg('') }}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors',
                tab === id
                  ? id === 'call'
                    ? 'bg-white text-green-700 shadow-sm'
                    : 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Number display */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Number</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xl font-mono font-semibold text-slate-900 tracking-widest min-h-[28px]">
                {displayNumber || <span className="text-slate-300 text-base font-sans font-normal">Enter number</span>}
              </span>
              {number && (
                <button onClick={backspace} className="text-slate-400 hover:text-slate-700 transition-colors p-1">
                  <Delete className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Dialpad */}
          <div className="grid grid-cols-3 gap-2">
            {KEYS.flat().map(key => (
              <button
                key={key}
                onClick={() => press(key)}
                disabled={tab === 'call' && callStatus === 'connected'}
                className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-900 font-semibold text-base transition-all active:scale-95"
              >
                {key}
              </button>
            ))}
          </div>

          {/* Name field */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Contact name <span className="text-slate-400">(optional)</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition"
            />
          </div>

          {/* SMS: message field */}
          {tab === 'sms' && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                placeholder="Type your message…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition resize-none"
              />
              <p className="text-right text-[11px] text-slate-400 mt-1">{message.length} chars</p>
            </div>
          )}

          {/* Call: status display */}
          {tab === 'call' && callStatus !== 'idle' && (
            <div className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium border',
              callStatus === 'calling'   && 'bg-amber-50 border-amber-200 text-amber-700',
              callStatus === 'connected' && 'bg-green-50 border-green-200 text-green-700',
              callStatus === 'ended'     && 'bg-slate-50 border-slate-200 text-slate-500',
              callStatus === 'error'     && 'bg-red-50 border-red-200 text-red-700',
            )}>
              {callStatus === 'calling'   && <><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />Calling {displayNumber || number}…</>}
              {callStatus === 'connected' && <><PhoneCall className="w-4 h-4" />Call initiated</>}
              {callStatus === 'ended'     && <><PhoneOff className="w-4 h-4" />Call ended</>}
              {callStatus === 'error'     && <><AlertCircle className="w-4 h-4 shrink-0" /><span>{errorMsg}</span></>}
            </div>
          )}

          {/* SMS status */}
          {tab === 'sms' && smsStatus === 'success' && (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Message sent!
            </div>
          )}
          {tab === 'sms' && smsStatus === 'error' && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
            </div>
          )}
        </div>

        {/* Action button */}
        <div className="px-4 py-4 border-t border-slate-200">
          {tab === 'sms' ? (
            <button
              onClick={handleSendSms}
              disabled={!number.trim() || !message.trim() || isPending || smsStatus === 'success'}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 transition-colors"
            >
              <Send className="w-4 h-4" />
              {isPending ? 'Sending…' : 'Send SMS'}
            </button>
          ) : callStatus === 'connected' || callStatus === 'calling' ? (
            <button
              onClick={handleHangup}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-3 transition-colors"
            >
              <PhoneOff className="w-4 h-4" />
              Hang Up
            </button>
          ) : (
            <button
              onClick={handleCall}
              disabled={!number.trim() || isPending || callStatus === 'ended'}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 transition-colors"
            >
              <PhoneCall className="w-4 h-4" />
              {isPending ? 'Connecting…' : 'Call'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
