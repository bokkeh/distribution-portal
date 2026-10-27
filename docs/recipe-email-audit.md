# Recipe email audit — October 26, 2026

## Observed records

The configured database contains one recipe campaign, week of October 19: 74 accepted by Resend, zero API failures, 18 in the combined bounce/suppression counter, zero complaints and zero recipient-initiated unsubscribes. The contact timeline records 17 hard bounces and one preexisting provider suppression. All 18 contacts are unsubscribed; 56 remain subscribed. Combined removals are 24.3%; recorded hard bounces alone are 23.0%. API acceptance does not prove inbox delivery.

The hard-bounce details explicitly say the recipient provider supplied no specific cause. They do not establish invalid mailboxes, DNS failure or a reputation block. Keep these addresses suppressed; do not retry or clear provider suppressions to improve the totals.

## Code findings and changes

- Existing recipe messages have individual signed unsubscribe URLs, HTML and text alternatives, honest recipe subjects, campaign tags, and RFC 8058 one-click headers. GET displays confirmation, POST removes the subscription without login. API routes bypass the authentication proxy.
- Existing signed Resend webhooks remove permanent bounces, complaints and suppressed recipients. Transient bounces do not unsubscribe contacts. Database records demonstrate that this handling ran for the October campaign; current production registration remains unverified.
- Added preflight validation before campaign creation: require a recipe-specific or existing Resend sender, reply address, physical mailing address, API key, webhook secret, unsubscribe signing secret, and an HTTPS origin. This deliberately blocks sending if required configuration is incomplete; it cannot verify domain authentication, mailbox ownership or address accuracy.
- Counters now count contact removals rather than repeated webhook notifications. The bounce column explicitly includes suppressions. Historical counts were not rewritten.

## Checks still required before declaring production ready

1. Inspect the production configuration and deployed code. Local `.env.local` lacks the recipe-specific sender, reply address, mailing address and webhook secret, and uses localhost. Those local values do not establish the production state.
2. Inspect Resend's verified sending domain, exact SPF return-path records, DKIM selector and DMARC alignment, and inspect authentication results from an already delivered message. Do not invent DNS records or assume the example sender is the live sender.
3. Confirm Resend webhook registration for `email.bounced`, `email.complained`, `email.suppressed`, its matching production signing secret, and successful recent deliveries.
4. Inspect the original SMTP responses and recipient domain breakdown in Resend. The available send-only API key returns 401 for domains, webhooks and email history.
5. Review list origin, explicit consent and address validation before further sends; the high observed failure rate warrants list hygiene review. Avoid automatically resubscribing bounced contacts through imports or profile edits. A second opt-in confirmation would improve protection against typos; it is not implemented by this patch.
6. Verify the physical postal address and monitored reply mailbox with the business. CAN-SPAM requires accurate identity, a valid postal address and a working opt-out; do not fabricate these values.

The Vercel connector returned 403 for the configured team, and its team-authorization endpoint returned 404 for both team ID and slug. The authenticated CLI fallback also reported that the specified scope does not exist. No production configuration was changed by this audit.

## Sources

- [FTC CAN-SPAM compliance guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)
- [Google email sender guidelines](https://support.google.com/mail/answer/81126): all senders need SPF or DKIM; bulk senders need SPF, DKIM, DMARC alignment and one-click unsubscribe. Google recommends all three authentication methods for all senders.
- [Resend suppression behavior](https://resend.com/changelog/suppression-list-support)

## Validation

Five configuration tests pass, covering complete settings, missing fields, unsafe unsubscribe origins and malformed sender/reply addresses. Focused ESLint and diff whitespace checks pass. This patch was prepared locally; it has not been deployed or exercised against live recipients.

## Production release preparation

The authenticated browser recovered access to the specified Vercel project. Confirmed production `COMMUNITY_EMAIL_MAILING_ADDRESS` and `RESEND_WEBHOOK_SECRET` are present. Saved `COMMUNITY_EMAIL_REPLY_TO=sales@wishervodka.com` in Production at the user's direction. The send validator accepts the existing `RESEND_FROM_EMAIL` as the sender fallback, preserving the configured sending domain. Resend delivery-history/domain access remains unavailable through the send-only API key; successful configuration presence does not establish authentication results or future inbox delivery.

Release checks include ten focused tests (configuration, optional contacts with a PostgreSQL migration/upsert check, and private-link redaction), focused lint, and the production build. Seven existing Next.js page signatures required Promise-only route props to pass the generated build type checks; these edits change types only.
