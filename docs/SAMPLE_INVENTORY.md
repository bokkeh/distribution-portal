# Sample inventory workflow

## Deployment

1. Apply `db/migrations/0055_sample_inventory_management.sql` with the normal Drizzle migration command.
2. Set `MONTHLY_INVENTORY_REPORT_EMAILS` to a comma-separated list of valid recipients. If omitted, the job discovers active admin/staff users whose first name is Kris, Kim, Alex, or Emily.
3. Ensure `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `NEXTAUTH_URL` are configured in Vercel.
4. Deploy `vercel.json`; `/api/cron/monthly-inventory-report` runs at 13:00 UTC on the first day of each month and reports the prior UTC calendar month.
5. In **Admin → Sample Inventory**, assign opening balances and thresholds. The migration seeds paid inventory into Warehouse - Landover and intentionally does not guess how legacy sample stock is split among people/locations.

## QuickBooks setup

Configure each of the six category cards with the corresponding QuickBooks account and optional class identifiers. Every fulfilled sample request creates one idempotent export-queue record. Until a QuickBooks API client and OAuth credentials are added, the portal produces an export-ready payload and lets an admin record the external QuickBooks transaction ID. It never marks an item exported automatically without that ID.

## Controls

- Admin and staff may record sample usage and fulfill replenishments.
- Only admins may change balances/thresholds, edit accounting mappings, and confirm QuickBooks exports.
- Location movements and request status history are append-only. Balance corrections create movement records; historical legacy tables remain untouched.
- Sample request idempotency keys, movement keys, export keys, report month uniqueness, and per-recipient sent lists prevent duplicate submissions and monthly sends.

## Reports

Generated monthly reports are retained in the database and available as CSV (movement detail) and PDF (management summary). Email delivery retries skip recipients already recorded as sent.

## Current integration limitation

There is no QuickBooks API/OAuth client in this repository. This feature implements mappings, approval state, export payload/status/error storage, and manual external-ID reconciliation. A live push requires a separately authorized QuickBooks connection.
