'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { saveTasterSmsConsent } from '@/actions/taster-sms-consent'
import { BirthDateGate } from './BirthDateGate'

export function TasterSmsConsent({ enabled, phone, consentCopy, preview = false }: { enabled: boolean; phone: string | null; consentCopy: string; preview?: boolean }) {
  const [state, action, pending] = useActionState(saveTasterSmsConsent, null)
  return <section className="max-w-lg space-y-3 rounded-xl border p-5">
    <h2 className="text-lg font-semibold">Tasting text messages</h2>
    <p className="text-sm">{enabled ? 'Consent and birthdate age check recorded. Text messages are enabled.' : 'Text messages are off until you explicitly agree and pass the birthdate age check.'}</p>
    <p className="text-sm">{consentCopy}</p>
    <p className="text-sm"><Link className="underline" href="/privacy">Privacy Policy</Link> · <Link className="underline" href="/terms">Terms and Conditions</Link></p>
    <form action={action} className="space-y-3">
      <label className="block space-y-1.5 text-sm"><span className="font-medium">Mobile phone number</span><input className="block w-full rounded-lg border px-3 py-2" type="tel" readOnly value={phone ?? ''} placeholder="Your saved profile phone number" /><span className="block text-xs text-muted-foreground">Update and save your phone number in your profile before opting in.</span></label>
      <BirthDateGate disabled={pending} />
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="smsConsent" disabled={pending} />I agree to receive these text messages at my saved phone number.</label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="age21" disabled={pending} />I confirm that I am 21 years of age or older.</label>
      <p className="text-xs text-muted-foreground">We validate your birthdate to confirm you are 21 or older; this does not verify a government ID. If you change your phone number, consent is required again. Email and portal access remain available without SMS consent.</p>
      <div className="flex flex-wrap gap-3"><button className="rounded border px-3 py-2" name="intent" value="grant" disabled={pending || !phone || preview}>Agree and enable texts</button><button className="rounded border px-3 py-2" name="intent" value="revoke" formNoValidate disabled={pending || !phone || preview}>Withdraw SMS consent</button></div>
      {preview && <p className="text-sm">This is a public preview of the profile form. <Link className="underline" href="/taster/profile">Sign in to record consent</Link>.</p>}
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}{state?.saved && <p role="status" className="text-sm">SMS consent saved.</p>}
    </form>
  </section>
}
