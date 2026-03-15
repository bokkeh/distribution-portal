import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { tastings } from '@/db/schema'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireFeature } from '@/lib/auth/session'
import { getTastingById } from '@/lib/tastings/read'

export default async function TastingReportPage({ searchParams }: { searchParams: Promise<{ tastingId?: string }> }) {
  const session = await requireFeature('tastings', 'taster', 'admin')
  const { tastingId } = await searchParams
  if (!tastingId) notFound()

  const tasting = await getTastingById(tastingId)
  if (!tasting) notFound()
  if (!session.user.roles.includes('admin') && tasting.assignedUserId !== session.user.id) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Card>
        <CardHeader><CardTitle>Submit Tasting Report</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900">{tasting.eventName}</p>
          <p>Use the tasting detail screen to enter bottles sold, notes, and store feedback.</p>
          <Link href={`/taster/tastings/${tasting.id}#report`}>
            <Button>Open Report Form</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
