import Link from 'next/link'
import { asc } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/db'
import { customerAccounts } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateCrmPersonForm } from '@/components/crm/CreateCrmPersonForm'
import CopyShareLink from '@/components/share/CopyShareLink'

export default async function NewCrmPersonPage() {
  await requireFeature('crm', 'admin')
  const accounts = await db.select({ id: customerAccounts.id, companyName: customerAccounts.companyName })
    .from(customerAccounts)
    .orderBy(asc(customerAccounts.companyName))

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link href="/admin/crm"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div><h1 className="font-display text-4xl font-bold uppercase text-[#181615]">Add people</h1><p className="text-sm text-slate-500">Create a company contact or add a community newsletter member.</p></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Card className="shadow-none"><CardHeader><CardTitle>Person details</CardTitle></CardHeader><CardContent><CreateCrmPersonForm accounts={accounts} /></CardContent></Card>
        <Card className="h-fit border-orange-200 bg-orange-50 shadow-none">
          <CardHeader><CardTitle>Community signup link</CardTitle><CardDescription>Copy and paste this link into email, social, QR codes, or event materials.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <CopyShareLink path="/community" label="Copy community signup link" />
            <Button asChild variant="outline" className="w-full bg-white"><Link href="/community">Open signup page</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
