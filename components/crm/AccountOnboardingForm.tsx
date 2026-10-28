'use client'
import { useActionState } from 'react'
import { saveAccountOnboarding, approveAccountTerms } from '@/actions/account-onboarding'
import type { accountOnboarding } from '@/db/schema'
import { PAYMENT_TERM_OPTIONS } from '@/lib/orders/payment-terms'
import { Button } from '@/components/ui/button'
export function AccountOnboardingForm({ accountId, approvedTerms, data, accounts, contacts, admin }: {
  accountId: string; approvedTerms: string | null; data: typeof accountOnboarding.$inferSelect | null
  accounts: { id: string; companyName: string }[]; contacts: { id: string; name: string }[]; admin: boolean
}) {
  const [state, action, pending] = useActionState(saveAccountOnboarding, {})
  const [approval, approve, approving] = useActionState(approveAccountTerms, {})
  const style = 'block w-full rounded border bg-white p-2 text-sm'
  return <section className="space-y-4 rounded-xl border bg-white p-4"><h3 className="font-semibold">Onboarding &amp; terms</h3>
    <p className="text-sm">Approved terms: {approvedTerms ?? 'Unknown'}. Requests do not grant credit.</p>
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="accountId" value={accountId}/><input type="hidden" name="revision" value={data?.revision ?? 0}/>
      <label>Referral contact<select className={style} name="referralContactId" defaultValue={data?.referralContactId ?? ''}><option value="">Unknown</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Referring business<select className={style} name="referringAccountId" defaultValue={data?.referringAccountId ?? ''}><option value="">Unknown</option>{accounts.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id}>{a.companyName}</option>)}</select></label>
      <label>Requested terms<input className={style} name="requestedTerms" defaultValue={data?.requestedTerms ?? ''} placeholder="e.g. Net 30" maxLength={100}/></label>
      <label>Onboarding status<select className={style} name="status" defaultValue={data?.status ?? 'new'}>{['new','collecting_details','pending_terms','ready','on_hold'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>WhatsApp phone<input className={style} name="whatsappPhone" defaultValue={data?.whatsappPhone ?? ''} placeholder="+12025550123"/></label>
      <label>WhatsApp follow-up<select className={style} name="whatsappStatus" defaultValue={data?.whatsappStatus ?? 'not_started'}>{['not_started','follow_up_needed','contact_link_ready','completed'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label className="sm:col-span-2">Internal onboarding notes<textarea className={style} name="notes" defaultValue={data?.notes ?? ''} maxLength={10000}/></label>
      <p role="status">{state.error ?? (state.success ? 'Saved' : '')}</p><Button disabled={pending}>Save onboarding</Button>
    </form>
    {data?.whatsappPhone && <a className="text-blue-700 underline" href={`https://wa.me/${data.whatsappPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">Open WhatsApp contact</a>}
    <p className="text-xs text-slate-500">WhatsApp follow-up is manual. Opening the contact link does not provision an account or send a message.</p>
    {admin && <form action={approve} className="space-y-2 border-t pt-3"><input type="hidden" name="accountId" value={accountId}/><input type="hidden" name="previousTerms" value={approvedTerms ?? ''}/>
      <label>Approve payment terms<select className={style} name="terms" defaultValue={approvedTerms ?? 'PREPAID'}>{PAYMENT_TERM_OPTIONS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></label>
      <label>Approval reason<input required minLength={3} className={style} name="reason"/></label><Button disabled={approving}>Record terms approval</Button><p role="status">{approval.error ?? (approval.success ? 'Approval recorded' : '')}</p>
    </form>}
  </section>
}
