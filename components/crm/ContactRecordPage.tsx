import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { contacts, customerAccounts } from '@/db/schema'
import { requireRole } from '@/lib/auth/session'
import { ContactRelationshipForm } from './ContactRelationshipForm'
import ContactCard from './ContactCard'

export async function ContactRecordPage({ contactId, mode }: { contactId: string; mode: 'admin' | 'staff' }) {
  const session = await requireRole(mode)
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
  if (!contact) notFound()
  const accounts = await db.select({ id: customerAccounts.id, companyName: customerAccounts.companyName }).from(customerAccounts).orderBy(customerAccounts.companyName)
  return <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
    <Link href={`/${mode}/crm?tab=company-contacts`} className="text-primary hover:underline">← Contacts</Link>
    <h1 className="text-2xl font-bold">{contact.name}</h1>
    <ContactCard contact={contact} />
    <ContactRelationshipForm contact={contact} accounts={accounts} userId={session.user.id} />
  </div>
}
