'use client'

import Image from 'next/image'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Chrome } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

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

    // Fetch session to get role and redirect accordingly
    const res = await fetch('/api/auth/session')
    const session = await res.json()
    const role = session?.user?.role

    const redirectMap: Record<string, string> = {
      admin: '/admin/dashboard',
      staff: '/staff/dashboard',
      driver: '/driver/deliveries',
      customer: '/customer/dashboard',
    }
    router.push(redirectMap[role] ?? '/admin/dashboard')
  }

  async function handleGoogleSignIn() {
    setError('')
    setGoogleLoading(true)
    await signIn('google', { callbackUrl: '/' })
    setGoogleLoading(false)
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <Image
            src="/brand/logo.png"
            alt="AHAWC logo"
            width={64}
            height={64}
            className="h-16 w-16 rounded-2xl bg-white p-2 shadow-sm object-contain"
            priority
          />
        </div>
        <CardTitle className="text-2xl font-bold">AHAWC Portal</CardTitle>
        <CardDescription>Sign in to your account to continue</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={googleLoading}>
          <Chrome className="w-4 h-4" />
          {googleLoading ? 'Redirecting...' : 'Continue with Google'}
        </Button>

        <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span>or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@ahawc.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
        <p className="text-xs text-center text-muted-foreground mt-4">
          New Google users are created automatically as customer accounts on first sign-in.
        </p>
      </CardContent>
    </Card>
  )
}
