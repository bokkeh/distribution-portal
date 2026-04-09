import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { contacts, customerAccounts, salesMembers } from '@/db/schema'
import { addContact } from '@/actions/crm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ContactCard from '@/components/crm/ContactCard'

export default async function SalesContactsPage({
  params,
}: {
  params: Promise<{ accountId: string }>
}) {
  const { accountId } = await params
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')
  const roles = session.user.roles ?? (session.user.role ? [session.user.role] : [])
  const canManageAny = roles.includes('admin') || roles.includes('sales_manager')

  const [account] = await db
    .select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      assignedSalesRepId: customerAccounts.assignedSalesRepId,
    })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, accountId))
    .limit(1)

  if (!account) notFound()

  if (!canManageAny) {
    const [member] = await db
      .select({ id: salesMembers.id })
      .from(salesMembers)
      .where(eq(salesMembers.userId, session.user.id))
      .limit(1)

    if (!member || account.assignedSalesRepId !== member.id) {
      notFound()
    }
  }

  const accountContacts = await db.select().from(contacts).where(eq(contacts.customerId, accountId))

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/sales/accounts/${accountId}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
          <p className="text-muted-foreground mt-1">{account.companyName}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Contacts ({accountContacts.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {accountContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts added yet.</p>
            ) : accountContacts.map((contact) => <ContactCard key={contact.id} contact={contact} />)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Add Contact</CardTitle></CardHeader>
          <CardContent>
            <form action={addContact} className="space-y-4">
              <input type="hidden" name="customerId" value={accountId} />
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
              <div className="space-y-2">
                <Label htmlFor="phoneType">Phone Type</Label>
                <select name="phoneType" id="phoneType" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="">Unknown</option>
                  <option value="mobile">Mobile (textable)</option>
                  <option value="landline">Landline (no texts)</option>
                  <option value="voip">VoIP</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredContact">Best Way to Contact</Label>
                <select name="preferredContact" id="preferredContact" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="">Not specified</option>
                  <option value="sms">Text / SMS</option>
                  <option value="email">Email</option>
                  <option value="call">Phone call</option>
                </select>
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
