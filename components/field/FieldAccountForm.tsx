'use client'

import { useRef, useState } from 'react'
import { createFieldAccount, getFieldAccount, type searchFieldAccounts } from '@/actions/field-data'
import { Button } from '@/components/ui/button'

export function FieldAccountForm({ initialName, onSelected, onCancel }: {
  initialName: string
  onSelected: (account: Awaited<ReturnType<typeof getFieldAccount>>, created: boolean) => void
  onCancel: () => void
}) {
  const requestId = useRef<string | null>(null), locked = useRef(false)
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const [matches, setMatches] = useState<Awaited<ReturnType<typeof searchFieldAccounts>>>([])
  const cls = 'mt-2 h-14 w-full rounded-xl border bg-white px-4 text-base'
  return <form className="space-y-4" onSubmit={async event => {
    event.preventDefault(); if (locked.current) return
    const data = new FormData(event.currentTarget)
    requestId.current ??= crypto.randomUUID()
    locked.current = true; setPending(true); setError(''); setMatches([])
    try {
      const result = await createFieldAccount({ requestId: requestId.current, companyName: String(data.get('companyName') ?? ''), address: String(data.get('address') ?? ''), city: String(data.get('city') ?? ''), state: String(data.get('state') ?? ''), zip: String(data.get('zip') ?? ''), email: String(data.get('email') ?? ''), phone: String(data.get('phone') ?? '') })
      if ('error' in result) { setError(result.error); setMatches(result.matches ?? []); return }
      onSelected(result.account, true)
    } catch { setError('Could not confirm save. Your details are kept. Retry the same entry.') }
    finally { locked.current = false; setPending(false) }
  }}>
    <h2 className="text-xl font-semibold">Add new account</h2>
    <p className="text-sm text-muted-foreground">Start with its name. Add location and contact details now or later.</p>
    <fieldset disabled={pending} className="space-y-4">
      <label className="block">Account name<input name="companyName" defaultValue={initialName} required maxLength={200} autoComplete="organization" className={cls} /></label>
      <details className="rounded-xl border bg-white p-4"><summary>Location & contact (optional)</summary><div className="mt-4 space-y-4">
        <label className="block">Street address<input name="address" autoComplete="street-address" maxLength={300} className={cls} /></label>
        <label className="block">City<input name="city" autoComplete="address-level2" maxLength={100} className={cls} /></label>
        <div className="grid grid-cols-2 gap-3"><label className="block">State<input name="state" autoComplete="address-level1" maxLength={2} pattern="[A-Za-z]{2}" placeholder="MD" className={cls} /></label><label className="block">ZIP<input name="zip" autoComplete="postal-code" inputMode="numeric" maxLength={10} pattern="[0-9]{5}(-[0-9]{4})?" className={cls} /></label></div>
        <label className="block">Email<input name="email" type="email" autoComplete="email" maxLength={254} className={cls} /></label>
        <label className="block">Phone<input name="phone" type="tel" autoComplete="tel" maxLength={40} className={cls} /></label>
      </div></details>
    </fieldset>
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p> : null}
    {matches.map(row => <Button key={row.id} type="button" variant="outline" className="h-auto min-h-16 w-full justify-start whitespace-normal p-3 text-left" disabled={pending} onClick={async () => {
      if (locked.current) return
      locked.current = true; setPending(true)
      try { onSelected(await getFieldAccount(row.id), false) } catch { setError('Could not load the existing account. Retry selecting it.') }
      finally { locked.current = false; setPending(false) }
    }}>Use {row.companyName}{row.city ? ` · ${row.city}` : ''}</Button>)}
    <Button className="h-14 w-full text-base" disabled={pending}>{pending ? 'Saving account…' : 'Save account & continue'}</Button>
    <Button type="button" variant="outline" className="h-12 w-full" disabled={pending} onClick={onCancel}>Back to account search</Button>
  </form>
}
