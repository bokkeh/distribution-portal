/** Dry run by default. Pass --apply to repair queued jobs without sending any SMS. */
import { neon } from '@neondatabase/serverless'
import { formatEasternDate, formatEasternTime, formatEasternTimeRange } from '../lib/tastings/time'
import { getTastingSmsDisposition, getTastingSmsSchedule, SCHEDULED_TASTING_SMS_KEYS, type ScheduledTastingSmsKey } from '../lib/tastings/sms-schedule'

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  const sql = neon(process.env.DATABASE_URL)
  const apply = process.argv.includes('--apply')
  const rows = await sql.query(`SELECT j.id, j.user_id, j.template_key, j.payload,
    t.id AS tasting_id, t.event_name, t.scheduled_at, t.end_at, t.status AS tasting_status,
    t.assigned_user_id, t.store_address, t.store_city, t.store_state, t.store_zip,
    u.phone, u.active, p.sms_notifications_enabled
    FROM scheduled_sms_jobs j LEFT JOIN tastings t ON t.id = j.tasting_id
    LEFT JOIN users u ON u.id = t.assigned_user_id
    LEFT JOIN user_preferences p ON p.user_id = u.id WHERE j.status = 'pending'`)
  const now = new Date()
  const counts = { refreshed: 0, cancelled: 0 }
  for (const row of rows) {
    const key = row.template_key as ScheduledTastingSmsKey
    const eligible = row.tasting_id && ['scheduled', 'confirmed'].includes(row.tasting_status)
      && row.assigned_user_id === row.user_id && row.active && row.phone
      && row.sms_notifications_enabled !== false && SCHEDULED_TASTING_SMS_KEYS.includes(key)
    const start = new Date(row.scheduled_at)
    const end = row.end_at ? new Date(row.end_at) : null
    const cancel = !eligible || getTastingSmsDisposition(key, start, end, now) === 'cancel'
    if (cancel) {
      counts.cancelled += 1
      if (apply) await sql.query(`UPDATE scheduled_sms_jobs SET status = 'cancelled', last_error = $1 WHERE id = $2 AND status = 'pending'`, ['Queue audit: ineligible tasting/recipient or expired reminder window.', row.id])
      continue
    }
    const payload = {
      ...row.payload, tastingId: row.tasting_id, userId: row.assigned_user_id, phoneNumber: row.phone,
      store_name: row.event_name,
      store_address: [row.store_address, row.store_city, row.store_state, row.store_zip].filter(Boolean).join(', ') || 'Store address not provided',
      date: formatEasternDate(start), start_time: formatEasternTime(start), time_range: formatEasternTimeRange(start, end),
      scheduledAt: start.toISOString(), endAt: end?.toISOString() ?? null,
    }
    counts.refreshed += 1
    if (apply) await sql.query(`UPDATE scheduled_sms_jobs SET payload = $1::jsonb, phone_number = $2, send_at = $3, last_error = NULL WHERE id = $4 AND status = 'pending'`, [JSON.stringify(payload), row.phone, getTastingSmsSchedule(start, end)[key].toISOString(), row.id])
  }
  console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry_run', ...counts, total: rows.length }))
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
