# Weekly recipe email engagement

The Weekly recipe emails dashboard and per-send recipient page now show open rate, click-through rate, engagement rate and click-to-open rate, plus unique counts, engagement trends, first recorded open/click timestamps and the marketing destinations clicked.

## Measurement

- Open rate: unique recipient contacts with a recorded image open / accepted emails for that send.
- Click-through rate: unique recipient contacts who followed a signed marketing link / accepted emails.
- Engagement rate: the union of openers and clickers / accepted emails. A recipient who does both counts once.
- Click-to-open rate: recorded openers who also clicked / recorded openers. Clickers who block images still contribute to click-through and engagement.
- Summary rates sum counts and accepted recipients across tracked sends; they are not averages of percentages.
- Existing bounce, complaint and unsubscribe information remains available. The former "delivered to Resend" label is clarified to "accepted by Resend"; service acceptance does not confirm inbox delivery. Rates intentionally use this known denominator, rather than invent a delivered-recipient count.

Recipients are unique within each send. Someone receiving two weekly sends contributes once to each. Repeated opens and repeated clicks on the same destination do not increase unique metrics. Distinct links may each show that recipient in their link-specific count.

An HTML image request records an observed open; signed redirects track marketing links in HTML and plain text. Existing unsubscribe links and List-Unsubscribe headers stay unchanged, and unsubscribe destinations are excluded from marketing clicks. Previews are not instrumented. HEAD requests never record opens/clicks. Cache prevention and deterministic event IDs prevent ordinary replay/refresh inflation.

Image blocking can hide opens, privacy proxies can fetch images without a human view, security scanners can follow links, and forwarded email activity is attributed to the original recipient. The UI explicitly describes these limitations; none of these metrics prove a human read or conversion.

## Existing data and permissions

Historical emails did not contain these tracking links or pixels. They remain "Not tracked", not 0%, and are excluded from aggregate engagement rates. The installed Resend key was verified read-only as send-only and cannot retrieve provider history or manage tracking. No provider permissions were broadened.

New successful runs receive a tracking coverage event. Only these runs (or runs with a recorded signed signal) display genuine observed zero activity. Zero denominators show a dash. Database read failures show "Unavailable" and leave normal send history visible.

The implementation reuses activity_events with a recipe_email entity and deterministic primary keys. Events store campaign ID, contact ID, kind and marketing destination, without IP addresses or user agents. No schema migration or new service is required. Signing uses the existing COMMUNITY_EMAIL_SECRET / NEXTAUTH_SECRET / AUTH_SECRET fallback, with a distinct HMAC purpose. Public tracking endpoints accept only signed, purpose-bound tokens. Redirect targets must be HTTPS without credentials; altering a destination invalidates its signature. Missing campaigns/contacts do not produce orphan events. An analytics outage never prevents a valid marketing redirect.

Dashboard and recipient permissions retain the existing admin CRM gate. Sending frequency, content selection, audiences, subscription status, existing delivery webhooks and all invoice workflows are unchanged. No real email was sent for verification.

## Verification

- `npm run test:recipe-engagement`: five token/rate/content tests and five isolated database/route tests passed, including tampering, wrong-purpose tokens, concurrent replay, first timestamps, unknown historical data, tracked zeroes, unique union counts, weighted rates and redirect behavior during an analytics outage.
- `npm run test:recipe-engagement:browser`: Chromium at 390px and 1440px passed rate cards, history cells, chart rendering, missing-data messages, measurement explanations and responsive table checks. Synthetic data only.
- Focused ESLint, TypeScript and production build passed. The existing Big Shoulders font fallback warning remains.

No production contact, send count, subscription, invoice or inventory record was changed during testing. Newly sent recipe emails will start accumulating engagement after deployment. Physical email-client image loading and end-to-end delivery of a real newsletter were not tested because no real email was sent.

