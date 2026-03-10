import { db } from '@/db'
import { contacts, customerAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PhoneSmsButton } from '@/components/crm/PhoneSmsButton'
import { addContact } from '@/actions/crm'
import Link from 'next/link'
import { ArrowLeft, User } from 'lucide-react'

export default async function ContactsPage({ params }: { params: { accountId: string } }) {
  const [account] = await db.select({ id: customerAccounts.id, companyName: customerAccounts.companyName }).from(customerAccounts).where(eq(customerAccounts.id, params.accountId))
  if (!account) notFound()

  const accountContacts = await db.select().from(contacts).where(eq(contacts.customerId, params.accountId))

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/crm/${params.accountId}`}><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
          <p className="text-muted-foreground mt-1">{account.companyName}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Existing Contacts */}
        <Card>
          <CardHeader><CardTitle>Contacts ({accountContacts.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {accountContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts added yet.</p>
            ) : accountContacts.map(c => (
              <div key={c.id} className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{c.name}</p>
                    {c.isPrimary && <Badge variant="info" className="text-xs">Primary</Badge>}
                  </div>
                  {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                  {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                  {c.phone ? <PhoneSmsButton phone={c.phone} recipientName={c.name} className="text-xs" /> : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Add Contact Form */}
        <Card>
          <CardHeader><CardTitle>Add Contact</CardTitle></CardHeader>
          <CardContent>
            <form action={addContact} className="space-y-4">
              <input type="hidden" name="customerId" value={params.accountId} />
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input name="name" id="name" required placeholder="Jane Smith" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input name="title" id="title" placeholder="Owner" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input name="email" id="email" type="email" placeholder="jane@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input name="phone" id="phone" type="tel" placeholder="555-0100" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="isPrimary" id="isPrimary" className="rounded" />
                <Label htmlFor="isPrimary">Primary contact</Label>
              </div>
              <Button type="submit" className="w-full">Add Contact</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
