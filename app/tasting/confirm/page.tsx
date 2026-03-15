import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { tastings } from '@/db/schema'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireFeature } from '@/lib/auth/session'
import { confirmTastingAssignment } from '@/actions/tastings'
import { getTastingById } from '@/lib/tastings/read'

export default async function TastingConfirmPage({ searchParams }: { searchParams: Promise<{ tastingId?: string }> }) {
  const session = await requireFeature('tastings', 'taster', 'admin')
  const { tastingId } = await searchParams
  if (!tastingId) notFound()

  const tasting = await getTastingById(tastingId)
  if (!tasting) notFound()
  if (!session.user.roles.includes('admin') && tasting.assignedUserId !== session.user.id) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Card>
        <CardHeader><CardTitle>Confirm Tasting Assignment</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900">{tasting.eventName}</p>
          <p>{new Date(tasting.scheduledAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          <p>{[tasting.storeAddress, tasting.storeCity, tasting.storeState, tasting.storeZip].filter(Boolean).join(', ') || 'Store address not provided'}</p>
          <form action={confirmTastingAssignment.bind(null, tasting.id)} className="pt-2">
            <Button type="submit">Confirm This Tasting</Button>
          </form>
          <Link href={`/taster/tastings/${tasting.id}`} className="block text-sm text-blue-600 underline">Open full tasting details</Link>
        </CardContent>
      </Card>
    </div>
  )
}
