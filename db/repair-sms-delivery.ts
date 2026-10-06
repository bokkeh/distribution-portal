/** Reconcile existing receipts without sending texts. Dry run unless --apply. */
import { neon } from '@neondatabase/serverless'
import { getMutableSmsStatuses, getSmsDeliveryUpdates, isFinalSmsStatus } from '../lib/telnyx/delivery-status'

function scheduledKey(body: string) {
  if (body.includes('You have a tasting tomorrow.')) return 'day_before_reminder'
  if (body.includes('Your tasting today starts at')) return 'day_of_reminder'
  if (body.includes('Your tasting window has started.')) return 'checkin_prompt'
  if (body.includes('Quick check in from the team.')) return 'mid_event_check'
  if (body.includes('Your tasting window has ended.')) return 'end_of_tasting'
  return null
}

async function main() {
  if (!process.env.DATABASE_URL || !process.env.TELNYX_API_KEY) throw new Error('DATABASE_URL and TELNYX_API_KEY are required')
  const sql = neon(process.env.DATABASE_URL)
  const apply = process.argv.includes('--apply')
  const rows = await sql.query(`SELECT id, phone_number, body, created_at, provider_message_id
    FROM sms_messages WHERE direction = 'outbound' AND status IN ('queued', 'sent')
    AND provider_message_id IS NOT NULL AND created_at >= now() - interval '7 days'
    ORDER BY created_at`)
  const counts: Record<string, number> = {}
  let lookupErrors = 0
  for (const row of rows) {
    const response = await fetch(`https://api.telnyx.com/v2/messages/${encodeURIComponent(row.provider_message_id)}`, {
      headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` }, signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) { lookupErrors += 1; continue }
    const result = await response.json()
    const update = getSmsDeliveryUpdates(result.data).find(update => update.phoneNumber.replace(/\D/g, '') === row.phone_number.replace(/\D/g, ''))
    if (!update) continue
    counts[update.status] = (counts[update.status] ?? 0) + 1
    if (!apply) continue
    await sql.query(`UPDATE sms_messages SET status = $1, delivery_error = $2 WHERE id = $3 AND status = ANY($4::text[])`,
      [update.status, update.error, row.id, getMutableSmsStatuses(update.status)])
    if (!isFinalSmsStatus(update.status)) continue
    await sql.query(`UPDATE notifications_log SET status = $1, provider_message_id = $2
      WHERE type = 'sms' AND status IN ('queued', 'sent') AND
      (provider_message_id = $2 OR (provider_message_id IS NULL AND message = $3
        AND right(regexp_replace(recipient_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace($4, '[^0-9]', '', 'g'), 10)
        AND sent_at BETWEEN $5::timestamptz - interval '1 minute' AND $5::timestamptz + interval '1 minute'))`,
      [update.status, row.provider_message_id, row.body, row.phone_number, row.created_at])
    const key = scheduledKey(row.body)
    if (key) await sql.query(`UPDATE scheduled_sms_jobs SET status = $1, provider_message_id = $2, last_error = $3
      WHERE status IN ('submitted', 'sent') AND
      (provider_message_id = $2 OR (provider_message_id IS NULL AND template_key = $4
        AND right(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10) = right(regexp_replace($5, '[^0-9]', '', 'g'), 10)
        AND sent_at BETWEEN $6::timestamptz - interval '1 minute' AND $6::timestamptz + interval '1 minute'))`,
      [update.status, row.provider_message_id, update.error, key, row.phone_number, row.created_at])
  }
  console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry_run', checked: rows.length, counts, lookupErrors }))
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
