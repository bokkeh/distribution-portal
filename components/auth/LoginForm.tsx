'use client'

declare global {
  interface Window {
    PasswordCredential?: new (init: { id: string; password: string }) => Credential
  }
}

import { useState } from 'react'
import Image from 'next/image'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Chrome, Loader2, CheckCircle2 } from 'lucide-react'
import { registerCustomerAccount } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  onSuccess?: () => void
}

async function getPostLoginDestination() {
  const res = await fetch('/api/auth/session')
  const session = await res.json()
  const role = session?.user?.role as string | undefined
  const roles = ((session?.user?.roles as string[] | undefined) ?? (role ? [role] : []))

  return roles.includes('admin') ? '/admin/dashboard'
    : roles.includes('staff') ? '/staff/dashboard'
    : roles.includes('driver') ? '/driver/deliveries'
    : roles.includes('sales_rep') || roles.includes('sales_manager') ? '/sales/dashboard'
    : roles.includes('taster') ? '/taster/welcome'
    : roles.includes('customer') ? '/customer/dashboard'
    : '/'
}

export function LoginForm({ onSuccess }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultEmail = searchParams.get('email') ?? ''
  const fromTasterSignup = searchParams.get('from') === 'taster-signup'
  const fromSalesRepSignup = searchParams.get('from') === 'sales-rep-signup'
  const [mode, setMode] = useState<'signin' | 'create'>(fromTasterSignup ? 'signin' : 'signin')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData(e.currentTarget)
    const email = fd.get('email') as string
    const password = fd.get('password') as string

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    if (typeof window !== 'undefined' && window.PasswordCredential) {
      try {
        const cred = new window.PasswordCredential({ id: email, password })
        await navigator.credentials.store(cred)
      } catch {}
    }

    if (onSuccess) {
      onSuccess()
      return
    }

    router.push(await getPostLoginDestination())
  }

  async function handleCreateAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData(e.currentTarget)
    const name = (fd.get('name') as string) || ''
    const companyName = (fd.get('companyName') as string) || ''
    const email = (fd.get('email') as string) || ''
    const password = (fd.get('password') as string) || ''
    const confirmPassword = (fd.get('confirmPassword') as string) || ''
    const phone = (fd.get('phone') as string) || ''

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    const result = await registerCustomerAccount({
      name,
      companyName,
      email,
      password,
      phone,
    })

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    const signInResult = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (signInResult?.error) {
      setError('Account created, but automatic sign-in failed. Please sign in manually.')
      setMode('signin')
      setLoading(false)
      return
    }

    router.push(await getPostLoginDestination())
  }

  async function handleGoogle() {
    setError('')
    setGoogleLoading(true)
    await signIn('google', { callbackUrl: '/' })
    setGoogleLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2 pb-2">
        <Image
          src="/brand/logo.png"
          alt="AHAWC"
          width={56}
          height={56}
          className="h-14 w-14 rounded-xl bg-white p-1.5 shadow-sm object-contain"
          priority
        />
        <h2 className="text-xl font-bold text-slate-900">
          {fromTasterSignup ? 'AHAWC Taster Portal' : 'AHAWC Portal'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {fromTasterSignup
            ? 'Sign in to your taster account'
            : mode === 'create'
              ? 'Create your customer account'
              : 'Sign in to your account'}
        </p>
      </div>

      {fromTasterSignup || fromSalesRepSignup ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-3.5 py-3 text-sm text-green-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          <span>
            {fromSalesRepSignup
              ? 'Sales rep account created. Sign in below to access your sales portal.'
              : 'Account created! Sign in below to access your taster portal.'}
          </span>
        </div>
      ) : (
        <div className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('signin')
              setError('')
            }}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('create')
              setError('')
            }}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === 'create' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Create Account
          </button>
        </div>
      )}

      <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={googleLoading}>
        {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chrome className="h-4 w-4" />}
        {googleLoading ? 'Redirecting...' : mode === 'create' ? 'Create with Google' : 'Continue with Google'}
      </Button>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {mode === 'create' && !fromTasterSignup ? (
        <form onSubmit={handleCreateAccount} autoComplete="on" className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cf-name">Your Name</Label>
            <Input id="cf-name" name="name" type="text" placeholder="Jane Smith" required autoComplete="name" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-company">Company Name</Label>
            <Input id="cf-company" name="companyName" type="text" placeholder="Acme Wine & Spirits" required autoComplete="organization" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-email">Email</Label>
            <Input id="cf-email" name="email" type="email" placeholder="you@business.com" required autoComplete="email" defaultValue={defaultEmail} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-phone">Phone</Label>
            <Input id="cf-phone" name="phone" type="tel" placeholder="+1 (555) 000-0000" autoComplete="tel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-password">Password</Label>
            <Input id="cf-password" name="password" type="password" placeholder="Create a password" required autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-confirm-password">Confirm Password</Label>
            <Input id="cf-confirm-password" name="confirmPassword" type="password" placeholder="Repeat your password" required autoComplete="new-password" />
          </div>

          {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account...</> : 'Create Account'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} autoComplete="on" className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lf-email">Email</Label>
            <Input id="lf-email" name="email" type="email" placeholder="you@ahawc.com" required autoComplete="email" autoFocus defaultValue={defaultEmail} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lf-password">Password</Label>
            <Input id="lf-password" name="password" type="password" placeholder="Password" required autoComplete="current-password" />
          </div>

          {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</> : 'Sign In'}
          </Button>
        </form>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Google still works for first-time customer setup, and email/password signup is now available here too.
      </p>
    </div>
  )
}
