'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createSalesRepInvite } from '@/actions/sales-rep-invites'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SalesRepInviteForm() {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  function resetForm() {
    setName('')
    setEmail('')
    setPhone('')
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    startTransition(async () => {
      const result = await createSalesRepInvite({ name, email, phone })
      if (!result.success) {
        toast.error('Invite not sent', { description: result.error })
        return
      }

      toast.success('Sales rep invite sent', {
        description: `An invite email was sent to ${email.trim().toLowerCase()}.`,
      })
      resetForm()
    })
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Invite Sales Rep</CardTitle>
        <CardDescription>
          Send a private signup link so the rep can create their own password and be set up as a sales rep automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="invite-name">Full Name</Label>
              <Input
                id="invite-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="jane@ahawc.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-phone">Phone</Label>
              <Input
                id="invite-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Invite links expire after 14 days. Sending a new invite for the same email revokes the previous pending link.
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? 'Sending invite...' : 'Send Invite'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
