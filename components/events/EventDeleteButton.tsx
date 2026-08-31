'use client'

import { startTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteEvent } from '@/actions/events'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export function EventDeleteButton({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  return <ConfirmDialog trigger={<Button type="button" variant="outline" className="w-full text-red-600"><Trash2 className="h-4 w-4" />Delete event</Button>} title={`Delete ${eventTitle}?`} description="This permanently removes the event, RSVPs, event communications, and uploaded event media. Community Contact records remain intact." confirmLabel="Delete event" variant="destructive" onConfirm={() => startTransition(() => { void deleteEvent(eventId) })} />
}
