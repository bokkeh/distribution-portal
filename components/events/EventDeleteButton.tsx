'use client'

import { startTransition } from 'react'
import { Archive } from 'lucide-react'
import { deleteEvent } from '@/actions/events'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export function EventDeleteButton({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  return <ConfirmDialog trigger={<Button type="button" variant="outline" className="w-full"><Archive className="h-4 w-4" />Archive event</Button>} title={`Archive ${eventTitle}?`} description="This removes the event from active event views while preserving its RSVPs, communications, media, planning details, and history." confirmLabel="Archive event" onConfirm={() => startTransition(() => { void deleteEvent(eventId) })} />
}
