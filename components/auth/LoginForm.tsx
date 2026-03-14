'use client'

import { useState } from 'react'
import Image from 'next/image'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Chrome, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  /** Called when the user successfully signs in — defaults to role-based redirect */
  onSuccess?: () => void
}

export function LoginForm({ onSuccess }: Props) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData(e.currentTarget)
    const result = await signIn('credentials', {
      email: fd.get('email') as string,
      password: fd.get('password') as string,
      redirect: false,
    })

    if (result?.error) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    if (onSuccess) {
      onSuccess()
      return
    }

    const res = await fetch('/api/auth/session')
    const session = await res.json()
    const role = session?.user?.role
    const map: Record<string, string> = {
      admin: '/admin/dashboard',
      staff: '/staff/dashboard',
      driver: '/driver/deliveries',
      taster: '/taster/tastings',
      customer: '/customer/dashboard',
    }
    router.push(map[role] ?? '/admin/dashboard')
  }

  async function handleGoogle() {
    setError('')
    setGoogleLoading(true)
    await signIn('google', { callbackUrl: '/' })
    setGoogleLoading(false)
  }

  return (
    <div className="space-y-4">
      {/* Logo */}
      <div className="flex flex-col items-center gap-2 pb-2">
        <Image
          src="/brand/logo.png"
          alt="AHAWC"
          width={56}
          height={56}
          className="h-14 w-14 rounded-xl bg-white p-1.5 shadow-sm object-contain"
          priority
        />
        <h2 className="text-xl font-bold text-slate-900">AHAWC Portal</h2>
        <p className="text-sm text-muted-foreground">Sign in to your account</p>
      </div>

      {/* Google */}
      <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={googleLoading}>
        {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Chrome className="w-4 h-4" />}
        {googleLoading ? 'Redirecting…' : 'Continue with Google'}
      </Button>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Credentials */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="lf-email">Email</Label>
          <Input id="lf-email" name="email" type="email" placeholder="you@ahawc.com" required autoComplete="email" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lf-password">Password</Label>
          <Input id="lf-password" name="password" type="password" placeholder="••••••••" required autoComplete="current-password" />
        </div>

        {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : 'Sign In'}
        </Button>
      </form>

      <p className="text-xs text-center text-muted-foreground">
        New Google users are automatically set up as customer accounts.
      </p>
    </div>
  )
}
