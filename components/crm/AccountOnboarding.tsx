import { db } from '@/db'
import { accountOnboarding, customerAccounts, contacts, activityEvents, users } from '@/db/schema'
import { and, eq, desc } from 'drizzle-orm'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { AccountOnboardingForm } from './AccountOnboardingForm'
export async function AccountOnboarding({ accountId, approvedTerms }: { accountId: string; approvedTerms: string | null }) {
  const session = await requireAdminOrStaff()
  const [[data], accounts, people, history] = await Promise.all([
    db.select().from(accountOnboarding).where(eq(accountOnboarding.accountId, accountId)),
    db.select({ id: customerAccounts.id, companyName: customerAccounts.companyName }).from(customerAccounts).orderBy(customerAccounts.companyName),
    db.select({ id: contacts.id, name: contacts.name }).from(contacts).orderBy(contacts.name),
    db.select({ id: activityEvents.id, at: activityEvents.createdAt, reason: activityEvents.body, metadata: activityEvents.metadata, actor: users.name }).from(activityEvents).leftJoin(users, eq(users.id, activityEvents.actorUserId)).where(and(eq(activityEvents.entityId, accountId), eq(activityEvents.entityType, 'account'), eq(activityEvents.kind, 'payment_terms_approved'))).orderBy(desc(activityEvents.createdAt)).limit(30),
  ])
  return <div className="space-y-3"><AccountOnboardingForm key={data?.revision ?? 0} accountId={accountId} approvedTerms={approvedTerms} data={data ?? null} accounts={accounts} contacts={people} admin={(session.user.roles ?? [session.user.role]).includes('admin')}/>
    <details className="rounded border p-3 text-sm"><summary>Terms approval history</summary>{!history.length && <p>No recorded approvals. Existing terms are retained.</p>}{history.map(h => <p key={h.id}>{h.at.toISOString()} · {h.actor ?? 'External or prior approval; see recorded reason'} · {JSON.stringify(h.metadata)} · {h.reason}</p>)}</details>
  </div>
}
