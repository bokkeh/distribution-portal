'use client'

import { useState, useTransition } from 'react'
import { registerAndSignInPartner } from '@/actions/auth'
import { BUSINESS_TYPE_OPTIONS } from '@/lib/customers/business-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

export function PartnerSignupForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await registerAndSignInPartner(formData)
      if (result && 'error' in result) setError(result.error ?? 'Something went wrong.')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Your Name</Label>
          <Input id="name" name="name" placeholder="Jane Smith" required autoComplete="name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone Number</Label>
          <Input id="phone" name="phone" type="tel" placeholder="(555) 000-0000" autoComplete="tel" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="companyName">Business Name</Label>
        <Input id="companyName" name="companyName" placeholder="Acme Liquors LLC" required autoComplete="organization" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="businessType">Business Type</Label>
        <select
          id="businessType"
          name="businessType"
          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Select a type…</option>
          {BUSINESS_TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Street Address</Label>
        <Input id="address" name="address" placeholder="123 Main St" autoComplete="street-address" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-1">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" placeholder="Rockville" autoComplete="address-level2" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="state">State</Label>
          <select
            id="state"
            name="state"
            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">—</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zip">ZIP Code</Label>
          <Input id="zip" name="zip" placeholder="20850" autoComplete="postal-code" />
        </div>
      </div>

      <div className="border-t pt-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email Address</Label>
          <Input id="email" name="email" type="email" placeholder="jane@acmeliquors.com" required autoComplete="email" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Create Password</Label>
          <Input id="password" name="password" type="password" placeholder="At least 8 characters" required autoComplete="new-password" minLength={8} />
        </div>
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isPending}>
        {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating your account…</> : 'Create Account & Browse Products'}
      </Button>

      <p className="text-center text-xs text-slate-500">
        Already have an account?{' '}
        <a href="/login" className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800">Sign in</a>
      </p>
    </form>
  )
}
