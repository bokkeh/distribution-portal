'use client'

import { useActionState } from 'react'
import { updatePublicEventRsvp } from '@/actions/events-public'
import { Button } from '@/components/ui/button'

export function PublicRsvpManager({ slug, token, currentStatus }: { slug: string; token: string; currentStatus: string }) {
  const [state, action, pending] = useActionState(updatePublicEventRsvp, null)
  return <form action={action} className="space-y-4"><input type="hidden" name="slug" value={slug} /><input type="hidden" name="token" value={token} /><label className="block text-sm font-medium" htmlFor="manage-rsvp-status">Your response</label><select id="manage-rsvp-status" name="rsvpStatus" defaultValue={currentStatus} className="w-full"><option value="confirmed">Confirmed</option><option value="maybe">Maybe</option><option value="declined">Can’t attend</option></select>{state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}{state?.success ? <p className="text-sm text-emerald-700">Your RSVP has been updated.</p> : null}<Button type="submit" disabled={pending} className="w-full bg-[#ff5a00] hover:bg-[#e65000]">{pending ? 'Saving…' : 'Update RSVP'}</Button></form>
}
