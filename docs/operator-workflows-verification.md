# Operator workflow implementation and verification

Implemented in the existing Next.js/React, Drizzle/Postgres, role authorization, and AHAWC component system. Existing uncommitted work was preserved. No deployment, live migration, business-record correction, billing mutation, or reference-app integration was performed.

## Delivered behavior

- Quick schedule from admin/staff calendar/list, sales tasting list, account record, and global quick add. Existing account/location or minimal new venue, date, start/end, venue timezone and explicit Unassigned. Contacts/notes/address optional; CRM, inventory, objectives and sales enrichment do not block booking.
- Server-confirmed summary, next booking, retained failure inputs, synchronous submission guard and stable request UUID/database idempotency. Conservative normalized venue matching and unique venue identity prevent duplicate new accounts without silently merging historical accounts.
- Canonical assignment including null; concurrent reassignment protection, cleared prior confirmation when assigning someone else, eligible active team roles, scoped reads, shared invalidation, independent notification/calendar processing.
- Venue timezone retained alongside UTC timestamps; wall-time validation rejects nonexistent and ambiguous DST times. Calendar/list/detail/account/dashboard labels and scheduled reminder/calendar payloads use the venue timezone. Legacy events retain the application's Eastern convention.
- Address dropdown owned by the component: pointer-safe selection, accessible keyboard navigation, outside/Escape dismissal, stale-result cancellation, bounded scrolling and manual entry fallback.
- Commercial segment labels clarify B2B wholesale versus B2C consumer. Organization type is separate, with Distributor and Distiller/Producer added to existing retailer, bar, restaurant and other options. Existing stored classifications remain intact.
- Standalone CRM contacts: nullable company, optional phone/email/last name, dedicated detail route, visible in lists, link/unlink existing or minimal new company later, distinct Keep in touch relationship and existing task follow-up.
- Inventory-only, price-only or combined observations. Price has product/SKU/size, currency, regular/promotional type, venue-local timestamp and optional notes. Separate append-only price observations preserve history without fabricated inventory. Partial combined-save errors state what saved and retain the remaining entry. Latest/history labels distinguish stale, unavailable and legacy date-only values. Compatible wholesale order activity and reported all-product tasting sales are labeled separately; no whole-store consumer sell-through or causal claims are invented.
- Revenue View all uses the existing expanded ranking, shared Eastern date boundaries and the same non-cancelled wholesale-order totals. Rows link accounts; booked revenue and reporting dates are explicit.

## Root causes traced

The long tasting form coupled scheduling to taster eligibility and economics/objectives. Required assignee columns and inner user joins excluded unassigned events. Mutations mixed persistence with secondary activity/SMS cleanup before broad refresh; uncontrolled assignment selectors could retain stale values. Upcoming logic dropped events at their start, and sales dashboard pagination selected farthest events before filtering. Some calendar/display dates used browser time or hardcoded Eastern.

Contacts required a company at database/form level and inner company joins hid standalone records. Segment labels did not explain their relationship to organization type. Google-managed autocomplete did not expose the dismissal/stale-response controls needed on touch devices. Inventory forms required a count, preventing price-only observations. Revenue navigation already targeted the expanded ranking in the existing working tree; consistency and reporting labels were verified and strengthened rather than assuming the note still applied.

## Read-only reported-record investigation

The accessible database contains a scheduled Kelly’s Spirits, Ellicott City MD tasting on **November 6, 2026**, 21:00–00:00 UTC (**4–7 p.m. Eastern**). **Natalie Heinrichs is the assignee**, rather than a venue contact. Its venue name differs from the feedback's “Kelly’s Liquors”; this is a likely match, not an asserted identity correction. Eastern is the existing application convention for this Maryland venue; no independent venue timezone field existed in the old data.

October 17 has a completed **2025** Downtown Rockville MoCo ABS tasting and a confirmed **2026** Muddy Branch MoCo ABS tasting, both assigned to Natalie in the accessible data. The feedback alone cannot identify which event Rachel should receive. No reassignment or replacement record was created. No mutation history evidence proves which failure caused either historical incident.

## Migration and configuration

Apply the repository migration chain, including existing **0078_account_price_history** before **0080_operator_workflows.sql**, before releasing this code. 0080 drops only required nullability/known FK constraints and adds nullable or defaulted columns; it does not update historical values. Historical date-only prices retain null observed_at and unspecified price type. Migration was exercised on isolated Postgres with historical fixtures; it was not applied live.

No new production service configuration. Address lookup continues using NEXT_PUBLIC_GOOGLE_MAPS_KEY, and manual entry works without it. PGlite and Playwright are development-only verification dependencies.

## Verification

- `npx tsc --noEmit --pretty false`: passed.
- `npm run build`: passed after retry with network access for existing Google Fonts; Big Shoulders fallback-font warning remains.
- `npm run test:operator`: 12 integration regressions passed using actual server actions, queries, schema and migration in isolated PGlite Postgres. Covers immediate upcoming/account visibility, dashboard pagination, persistent reassignment, Unassigned, notification outage, duplicate retries/concurrent taps, minimal venues, standalone/link-later contacts, independent count/price/both, append-only history, account scope, migration preservation, venue/year/DST boundaries and reminder/report dates.
- Existing `tsx --test` suites for tests/, tasting, events, pull-through and progression: 95 passed.
- `npm run test:operator:browser`: passed at Chromium desktop 1280x900 and touch/mobile 390x844. Actual form and upcoming list invoke actual server actions against isolated Postgres. Verified failure retention, repeated taps, server-confirmed save, immediate upcoming refresh, next booking, no horizontal overflow, address touch/keyboard/outside/Escape/stale/manual behavior. Uses actual portal CSS; screenshots in tmp/operator-tests.
- Focused ESLint workflow-file checks: no errors; one existing unused helper warning in actions/tastings.ts. Repository-wide `npm run lint` fails on existing source errors and generated/copied files under tmp (33,228 total problems in that unrestricted run); unrelated files were not rewritten to clean the baseline.

## Verification limits

The browser harness stubs framework/authentication, outbound notifications/calendar and Google Places boundaries while exercising actual local persistence and rendering. A deployed authenticated session, real notification delivery, external calendar synchronization and real Places service were not tested. No physical iPhone or WebKit runtime was available, so iPhone Safari is unverified. The October 17 intended record/year remains unresolved. Live rollout and migrations remain outstanding.

## Authorized release

Production project/master/domain verified via the signed-in AHAWC browser. Migrations 0078, 0080 and 0081 applied atomically to the matching production database; before/after business row counts unchanged. No historical business record was corrected or created. Release checkout from remote 36b8a2b passed TypeScript, production build and all 20 field/operator integration tests.
