'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PhoneSmsButton } from './PhoneSmsButton'

export interface PersonRow {
  id: string
  name: string
  title: string | null
  email: string | null
  phone: string | null
  preferredContact: string | null
  isPrimary: boolean
  companyName: string
  customerId: string
}

export function LocalPeopleTable({
  people,
  basePath,
}: {
  people: PersonRow[]
  basePath: '/admin/crm' | '/staff/crm'
}) {
  if (people.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-muted-foreground">
        No CRM contacts yet. Add contacts to accounts to build your people view.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Person</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Title</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Company</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Preferred Contact</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {people.map((person) => (
            <tr key={person.id} className="transition-colors hover:bg-slate-50">
              <td className="px-4 py-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">{person.name}</p>
                  {person.isPrimary ? <Badge variant="success">Primary contact</Badge> : null}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{person.title ?? '-'}</td>
              <td className="px-4 py-3 text-sm font-medium text-slate-900">{person.companyName}</td>
              <td className="px-4 py-3 text-sm">
                {person.phone ? (
                  <PhoneSmsButton phone={person.phone} recipientName={person.name} />
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{person.email ?? '-'}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {person.preferredContact ? person.preferredContact.toUpperCase() : '-'}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <Link href={`${basePath}/${person.customerId}`}>
                    <Button variant="ghost" size="sm">View Account</Button>
                  </Link>
                  <Link href={`${basePath}/${person.customerId}/contacts`}>
                    <Button variant="outline" size="sm">Manage Contact</Button>
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
