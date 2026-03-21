'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createSalesMember } from '@/actions/sales-members'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function NewSalesMemberPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    hireDate: '',
    homeRegion: '',
    notes: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createSalesMember({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password || undefined,
        hireDate: form.hireDate || undefined,
        homeRegion: form.homeRegion || undefined,
        notes: form.notes || undefined,
      })
      if ('error' in result && result.error) {
        setError(result.error)
      } else if (result.success && result.id) {
        router.push(`/admin/sales/members/${result.id}`)
      }
    })
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/sales/members">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add Sales Member</h1>
          <p className="text-slate-500 text-sm">Create a new sales rep or manager account</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Member Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" name="name" value={form.name} onChange={handleChange} required placeholder="Jane Smith" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} required placeholder="jane@ahawc.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" value={form.phone} onChange={handleChange} placeholder="+1 (555) 000-0000" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="password">Initial Password</Label>
                <Input id="password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Leave blank for 'changeme123'" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hireDate">Hire Date</Label>
                <Input id="hireDate" name="hireDate" type="date" value={form.hireDate} onChange={handleChange} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="homeRegion">Home Region</Label>
                <Input id="homeRegion" name="homeRegion" value={form.homeRegion} onChange={handleChange} placeholder="e.g. DC Metro" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" value={form.notes} onChange={handleChange} placeholder="Optional notes" />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isPending} className="flex-1">
                {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Member
              </Button>
              <Link href="/admin/sales/members">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
