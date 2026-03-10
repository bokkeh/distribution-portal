import { db } from '@/db'
import { chartOfAccounts } from '@/db/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createJournalEntry } from '@/actions/accounts'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function NewJournalEntryPage() {
  const accounts = await db.select().from(chartOfAccounts).where(chartOfAccounts.active as any)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/accounts/journal"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Journal Entry</h1>
          <p className="text-muted-foreground mt-1">Record a double-entry accounting transaction</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Journal Entry</CardTitle></CardHeader>
        <CardContent>
          <form action={createJournalEntry} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input type="date" name="date" id="date" required defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Reference (optional)</Label>
                <Input name="reference" id="reference" placeholder="INV-2024-00001" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input name="description" id="description" required placeholder="Payment received for invoice..." />
            </div>

            <div className="space-y-3">
              <Label>Debit Line</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <select name="debitAccountId" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">Select account...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.accountNumber} — {a.accountName}</option>)}
                  </select>
                </div>
                <Input type="number" name="debitAmount" step="0.01" min="0.01" required placeholder="Amount" />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Credit Line</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <select name="creditAccountId" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">Select account...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.accountNumber} — {a.accountName}</option>)}
                  </select>
                </div>
                <Input type="number" name="creditAmount" step="0.01" min="0.01" required placeholder="Amount" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit">Save Entry</Button>
              <Link href="/admin/accounts/journal"><Button variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
