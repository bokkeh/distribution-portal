import { EventsIndexPage } from '@/components/events/EventsIndexPage'

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <EventsIndexPage mode="admin" filters={await searchParams} />
}
