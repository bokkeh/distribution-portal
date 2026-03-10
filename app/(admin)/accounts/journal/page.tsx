import { db } from '@/db'
import { journalEntries, users } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Plus, ArrowLeft } from 'lucide-react'

export default async function JournalEntriesPage() {
  const entries = await db
    .select({
      id: journalEntries.id,
      date: journalEntries.date,
      description: journalEntries.description,
      reference: journalEntries.reference,
      createdAt: journalEntries.createdAt,
      createdByName: users.name,
    })
    .from(journalEntries)
    .leftJoin(users, eq(journalEntries.createdBy, users.id))
    .orderBy(desc(journalEntries.createdAt))

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/accounts"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Journal Entries</h1>
          <p className="text-muted-foreground mt-1">Double-entry bookkeeping ledger</p>
        </div>
        <Link href="/admin/accounts/journal/new">
          <Button><Plus className="w-4 h-4 mr-2" />New Entry</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Reference</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Created By</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">No journal entries yet.</td></tr>
              ) : entries.map(entry => (
                <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm">{formatDate(entry.date)}</td>
                  <td className="px-6 py-4 text-sm font-medium">{entry.description}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{entry.reference ?? '—'}</td>
                  <td className="px-6 py-4 text-sm">{entry.createdByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
