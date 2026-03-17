import { logActivityEvent } from '@/lib/activity/log'

export async function logAccountNoteEvent(input: {
  accountId: string | null | undefined
  actorUserId?: string | null
  title: string
  note: string | null | undefined
  source: 'delivery_stop' | 'sales_route_stop'
  sourceId?: string | null
}) {
  const note = input.note?.trim()
  if (!input.accountId || !note) return

  await logActivityEvent({
    entityType: 'account',
    entityId: input.accountId,
    actorUserId: input.actorUserId ?? null,
    kind: `${input.source}_note_added`,
    title: input.title,
    body: note,
    metadata: {
      source: input.source,
      sourceId: input.sourceId ?? null,
    },
  })
}
