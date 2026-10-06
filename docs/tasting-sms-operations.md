# Tasting SMS delivery

Messages are queued with current tasting details. Before each send, the worker checks the current assignee, recipient preferences, tasting status, location and valid reminder window. Expired prompts are cancelled, not replayed.

GitHub Actions `.github/workflows/tasting-sms.yml` invokes `https://ahawc.com/api/cron/tasting-sms` every 15 minutes using the encrypted repository secret `TASTING_SMS_CRON_SECRET`. GitHub can delay scheduled runs; the worker validates the time window on every invocation. Vercel's daily morning cron remains a fallback. Overlapping runs atomically claim jobs, preventing duplicate sends.

The Telnyx messaging profile points to `/api/webhooks/telnyx/inbound`, which shares the signed handler with `/api/webhooks/telnyx`. Outbound `message.sent` and `message.finalized` events update delivery records; they do not create inbound replies or trigger inbound-message alerts. A bounded receipt poll in the worker repairs missed callbacks.

- `queued` / `submitted`: Telnyx accepted the request. Delivery is not confirmed.
- `sent`: the carrier has the message. Delivery is not confirmed.
- `delivered`: confirmed by the carrier.
- `failed`: carrier rejection or API failure. The inbox or job record shows the reason.
- `delivery_unconfirmed`: no confirmed delivery. Do not automatically retry.

Do not resend historical reminders or automatically retry registration failures. After registration is approved, verify number assignment is `ASSIGNED`, then test one authorized, current message and inspect its carrier receipt. Only failed jobs can be retried through the admin action; the worker still rejects obsolete jobs.

Apply `db/migrations/0071_sms_delivery_tracking.sql` before deploying the code. Existing records can be reconciled with `db/repair-sms-delivery.ts` (dry run by default; `--apply` saves carrier results without sending any SMS).
