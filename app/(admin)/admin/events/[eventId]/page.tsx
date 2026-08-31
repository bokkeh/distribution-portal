import { EventDetailPage } from '@/components/events/EventDetailPage'

export default async function AdminEventDetail({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const { eventId } = await params
  return <EventDetailPage mode="admin" eventId={eventId} query={await searchParams} />
}
