import { asc } from 'drizzle-orm'
import Link from 'next/link'
import { createTasterBackupTasting } from '@/actions/tastings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { db } from '@/db'
import { customerAccounts } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'

export default async function LogMissingTastingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  await requireFeature('tastings', 'taster', 'admin')
  const query = await searchParams

  const accounts = await db
    .select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      city: customerAccounts.city,
      state: customerAccounts.state,
    })
    .from(customerAccounts)
    .orderBy(
      asc(customerAccounts.companyName),
      asc(customerAccounts.city),
      asc(customerAccounts.state),
    )

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Log Missing Tasting</h1>
          <p className="text-muted-foreground mt-1">
            Use this when a tasting happened but no longer appears in the portal. This creates a backup entry so you can finish the report and invoice.
          </p>
        </div>
        <Link href="/taster/tastings">
          <Button variant="outline">Back To My Tastings</Button>
        </Link>
      </div>

      {query.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {query.error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Create Backup Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createTasterBackupTasting} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="customerId">Store Account</Label>
              <select
                id="customerId"
                name="customerId"
                required
                defaultValue=""
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                <option value="" disabled>Select the store for this tasting</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {[account.companyName, account.city, account.state].filter(Boolean).join(' - ')}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Event Date</Label>
                <Input id="date" name="date" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Start Time</Label>
                <Input id="time" name="time" type="time" defaultValue="17:00" required />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input id="endTime" name="endTime" type="time" />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Backup entries are for tastings that already happened or are in progress. They open the report and invoice flow immediately.
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="Add any context staff should see, like why the original tasting is missing from the portal."
              />
            </div>

            <Button type="submit" className="w-full sm:w-auto">Create Backup Entry</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
