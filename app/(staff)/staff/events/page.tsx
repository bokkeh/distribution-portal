import { EventsIndexPage } from '@/components/events/EventsIndexPage'

export default async function StaffEventsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <EventsIndexPage mode="staff" filters={await searchParams} />
}
