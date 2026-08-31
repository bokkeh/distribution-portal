import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ArrowLeft, Camera } from 'lucide-react'
import { db } from '@/db'
import { events } from '@/db/schema'
import { PublicEventUpload } from '@/components/events/PublicEventUpload'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default async function EventUploadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1)
  if (!event || event.visibility === 'draft' || event.status === 'cancelled' || event.attendeeUploadPolicy === 'disabled') notFound()
  return <main className="min-h-screen bg-[#f4f1ed] px-4 py-8 sm:py-14"><div className="mx-auto max-w-3xl"><Button asChild variant="ghost" className="mb-5"><Link href={`/events/${event.slug}`}><ArrowLeft className="h-4 w-4" />Back to event</Link></Button><div className="text-center"><Camera className="mx-auto h-12 w-12 text-[#ff5a00]" /><h1 className="font-display mt-4 text-4xl font-bold uppercase sm:text-6xl">Share your event moments</h1><p className="mx-auto mt-3 max-w-xl text-slate-600">Upload photos and short videos from {event.title}. No portal account needed.</p></div><Card className="mt-8 border-0 shadow-xl"><CardContent className="p-5 sm:p-8"><PublicEventUpload slug={event.slug} policy={event.attendeeUploadPolicy} /></CardContent></Card></div></main>
}
