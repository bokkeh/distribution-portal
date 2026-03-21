'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createSalesMember, promoteUserToSalesMember } from '@/actions/sales-members'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, UserPlus, Users } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type ExistingUser = {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
}

interface Props {
  existingUsers: ExistingUser[]
}

export function AddSalesMemberForm({ existingUsers }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // Shared optional fields
  const [hireDate, setHireDate] = useState('')
  const [homeRegion, setHomeRegion] = useState('')
  const [notes, setNotes] = useState('')

  // New user fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  const filtered = existingUsers.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'existing') {
      if (!selectedUserId) {
        setError('Please select a user.')
        return
      }
      startTransition(async () => {
        const result = await promoteUserToSalesMember({
          userId: selectedUserId,
          hireDate: hireDate || undefined,
          homeRegion: homeRegion || undefined,
          notes: notes || undefined,
        })
        if (!result.success) {
          setError(result.error ?? 'Something went wrong.')
        } else if (result.id) {
          router.push(`/admin/sales/members/${result.id}`)
        }
      })
    } else {
      startTransition(async () => {
        const result = await createSalesMember({
          name,
          email,
          phone: phone || undefined,
          password: password || undefined,
          hireDate: hireDate || undefined,
          homeRegion: homeRegion || undefined,
          notes: notes || undefined,
        })
        if (!result.success) {
          setError(result.error ?? 'Something went wrong.')
        } else if (result.id) {
          router.push(`/admin/sales/members/${result.id}`)
        }
      })
    }
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
          <p className="text-slate-500 text-sm">Promote an existing user or create a new account</p>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
        <button
          type="button"
          onClick={() => setMode('existing')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
            mode === 'existing' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <Users className="w-4 h-4" />
          From Existing User
        </button>
        <button
          type="button"
          onClick={() => setMode('new')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
            mode === 'new' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <UserPlus className="w-4 h-4" />
          Create New Account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'existing' ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select User</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                {filtered.length === 0 ? (
                  <p className="text-sm text-slate-400 p-4 text-center">No users found.</p>
                ) : (
                  filtered.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedUserId(u.id)}
                      className={cn(
                        'w-full text-left px-4 py-3 text-sm transition-colors',
                        selectedUserId === u.id
                          ? 'bg-blue-50 border-l-2 border-l-blue-500'
                          : 'hover:bg-slate-50'
                      )}
                    >
                      <p className="font-medium text-slate-900">{u.name}</p>
                      <p className="text-slate-400 text-xs">{u.email} · {u.role}</p>
                    </button>
                  ))
                )}
              </div>
              {selectedUserId && (
                <p className="text-xs text-blue-600">
                  ✓ Selected: {existingUsers.find(u => u.id === selectedUserId)?.name} — will be given the <strong>sales_rep</strong> role
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label>Full Name *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Jane Smith" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email *</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="jane@ahawc.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Initial Password</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank for 'changeme123'" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shared optional fields */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Optional Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Hire Date</Label>
                <Input type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Home Region</Label>
                <Input value={homeRegion} onChange={e => setHomeRegion(e.target.value)} placeholder="e.g. DC Metro" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes" />
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {mode === 'existing' ? 'Promote to Sales Member' : 'Create Member'}
          </Button>
          <Link href="/admin/sales/members">
            <Button variant="outline" type="button">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
