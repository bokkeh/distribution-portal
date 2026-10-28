# Stakeholder workflow implementation and verification

Implemented in the existing Next.js, React, Drizzle/Postgres, authorization and AHAWC UI. Existing uncommitted work was retained. No deployment or live migration was performed. Live database access was read-only; no customer account, customer message, or credit approval was created during development.

## Delivered

- Order detail now has one autosaving editor for independent payment status/method, fulfillment, shipping and driver responsibility. Admin/staff authorization and feature access are checked on the server. Stripe payments remain provider-managed. Existing fulfillment transitions are preserved; cancellation requires confirmation.
- Saves compare the original operational fields, so concurrent legacy forms/webhooks cannot be silently overwritten. The update and actor/before/after activity record are one SQL statement. Retrying an already-applied save is idempotent. Inventory synchronization failure is reported separately after a durable save. Order lists show driver names. Route dispatch remains the existing separate delivery workflow.
- Pending edits are retained in session storage in the same tab; link navigation, supported Navigation API traversals and browser unload warn while unsaved. Failed requests expose retry; conflicts retain local inputs and require explicit discard/reload. Browser storage is not a server save, and this is not cross-device draft synchronization.
- CRM tasting cards show date, assigned taster (falling back to report submitter), actual submitted bottle count, event/report statuses, and report navigation. Zero is distinct from missing data. Existing batched joins are used. Staff links filter the full report view; sales links open the corresponding scoped report.
- Historical purchases support original dates, case/bottle quantities, original unit prices, line values, source references, unknown payment/fulfillment states, corrections with revision checks, and voiding without deleting provenance. Multi-SKU rows share a source reference to represent one purchase; enter line totals on those rows. No current catalog prices are applied.
- Duplicate review checks existing historical/live purchases. Unique fingerprints prevent concurrent exact inserts; exact overlaps already in imported/manual/live records are conservatively excluded from summaries and flagged. A documented review reason preserves verified separate purchases. Historical purchases feed shared economics and lifetime count/dates/frequency/history. No historical entry dispatches, charges, grants commissions, or changes current stock.
- Purchase frequency is mean elapsed days between consecutive recorded purchases. Earliest recorded purchase is explicitly not a verified first-ever purchase. Historical product rows show the recorded price and quantity history; chronological history combines live and reconciled historical purchases. Unknown historical values make total revenue insufficient-data rather than zero.
- Shared CRM and sales-tasting economics now require explicit tasting links or documented overrides for attribution. Timing observations do not establish causation. Unknown sales do not become organic or 0% dependent. Bottle orders contribute case equivalents using product pack sizes. Missing product pack sizes retain the existing documented 12-bottle conversion assumption; legacy conversions therefore remain estimates.
- Approved/paid invoice costs take precedence over estimates; submitted-but-unapproved invoices do not become actual expense. Real zero invoice costs remain zero. Approved invoice expense and remaining estimates are displayed separately. Gross contribution uses the configured contribution-per-case assumption; net subtracts retail tasting expense, with strategic costs separate. ROI requires explicit linked sales, complete attribution and actual approved cost. All linked orders contribute, rather than only the first. Observed 30/60/90-day purchase windows do not claim causal ROI.
- Removed the separate sales tasting page's before/after revenue comparison, sample/canceled-order inclusion and per-account query loop. The page now uses the same scoped batch dataset and formulas as CRM, including historical purchases and insufficient-data states.
- “My Rank” is documented in the UI as an assigned Wisher career level, not an ordinal sales leaderboard. It retains existing level requirements, review/assignment history and all-recorded-history performance measures. Wholesale credit uses the representative on the order, not today's account owner. Members can share a career level; no competitive position or tie-breaker is invented.
- Onboarding stores referral contact/business, requested terms, workflow status, notes, WhatsApp phone and manual follow-up state on the existing account. Requested and approved terms are separate. Admin approval requires a reason and atomically records history; general CRM edits cannot bypass that approval path. New CRM accounts start prepaid, including the former implicit Net 30 HubSpot-company conversion path. No existing account terms were changed.
- WhatsApp has no supported automated provisioning integration in this repository. The workflow provides a manual `wa.me` contact link without prefilled text or automatic messaging.
- Contact compose exposes actual configured sender and reply-to, validates addresses, escapes HTML, handles returned Resend errors, and uses durable claim/idempotency protection. Drafts, queued, accepted, unknown transport outcomes, delivered and failed states are distinct. Contact/account history records subject, body, identities, timestamp, provider ID and signed provider delivery events. Duplicate callbacks are ignored. Older unrecorded messages are not fabricated.
- Recipe management supports seasonal tags, inclusive date windows, draft/published content, explicit weekly-email/event overrides and preview. Rotation prefers eligible seasonal recipes, then evergreen recipes; no eligible content means skip. An invalid explicit selection blocks sending rather than substituting another recipe. Incomplete recipes cannot publish or be selected. Event selection is separate from weekly-email selection.

## Read-only stakeholder-data findings (2026-10-27)

Kensington Montgomery Country Liquor & Wine has seven tasting records: five completed, one scheduled and one confirmed. All seven have report rows; six have bottle counts, including a real zero. The 2024-11-23 report has no sales/sample counts. The 2026-08-22 and 2026-10-03 events have reports but retain scheduled/confirmed statuses. Only two approved invoices were found, totaling $165. Thus seven records, six populated sales reports, five completed statuses and two approved invoices are different supported counts. “Seven paid tastings” is not supported by those records. No dates, statuses, costs or account identities were rewritten automatically.

The existing account search found “Kelly's Spirits” and “Olde Tyme Liquors”, but the supplied onboarding phone did not match an existing account/contact. “Kelly's Liquor” was not verified as the same entity. Email-shaped account names also exist; these were not silently merged.

The public Wisher recipe collection was inspected. No Autumn Sunrise recipe was found. Migration 0089 creates only an unpublished, empty “Wisher Autumn Sunrise” draft. Approved ingredients and instructions, the intended Friday/date and tasting event must be supplied before selection. No recipe was invented and no event was guessed.

## Migrations and rollout

Apply the normal reviewed migration process before deploying these routes. These migrations were tested on an isolated PGlite/PostgreSQL database, not applied to production:

1. `0085_order_operations`: revision and existing-driver foreign key on orders.
2. `0086_contact_email_history`: communication history, provider events and indexes.
3. `0087_account_onboarding`: account-keyed onboarding and requested terms.
4. `0088_historical_order_details`: original prices, source reference, nullable statuses, revision, duplicate review and unique fingerprint.
5. `0089_managed_recipes`: recipe content/metadata and explicit selections; empty unpublished Autumn Sunrise draft.

Resend requires `RESEND_API_KEY` and an authorized `RESEND_FROM_EMAIL`; `RESEND_REPLY_TO_EMAIL` is optional and otherwise replies go to the sender. Confirm the existing signed webhook subscription includes `email.delivered`, `email.bounced`, `email.suppressed` and `email.failed`. Acceptance is not confirmed delivery. Unknown network outcomes require provider/history review before a new send; no automatic blind resend is attempted.

## Verification

- `npm run test:stakeholder`: 22 pure regression cases and 13 isolated database/provider cases pass.
- `npm run test:stakeholder:browser`: Chrome/local mock-server scenarios pass for autosave, reload persistence, failed save, navigation warning, retained edits, retry, conflict protection and recovery when a saved response was lost. Screenshot: `tmp/stakeholder-browser/order-conflict.png`.
- Existing `test:operator`: 12 pass; `test:field`: 20 pass.
- Existing pull-through metrics, progression metrics and tasting report workflow suites: 18 pass.
- Production build passed after retrying with filesystem permission to clean generated `.next` output. Existing Big Shoulders fallback-font warning remains nonfatal.
- TypeScript and targeted lint checks are recorded in the final task response. Browser/provider tests use synthetic data and mocks; no live recipient was used.

## Remaining decisions and limits

- Resolve Kensington's report/event-status inconsistencies and obtain missing actual costs from source records. The application now exposes uncertainty rather than deciding which count was intended.
- Confirm the onboarding business identity. Existing records were preserved; the stakeholder example was not turned into a live account.
- Supply approved Autumn Sunrise content and select the intended event explicitly.
- Business owners must approve any causal attribution model beyond explicit links and documented overrides. Existing timing-window settings are retained but no longer prove causation. Contribution and incomplete legacy pack-size data remain assumptions, not measured gross profit or sell-through.
- If the stakeholder intended a competitive sales rank instead of the existing career level, define the ranking metric, comparison group and period before introducing a separate leaderboard.
- Legacy multi-product imports without source order references cannot be confidently grouped into original purchases. Their stored row identity is retained; add verified source references through correction. Exact overlaps remain inspectable and reversible rather than deleting imported records.

## Authorized migration follow-up (2026-10-27)

At the user's request, migrations 0085–0089 were applied to the configured portal database using npm run db:migrate. Preflight confirmed the ledger ended at 0084 with only these five entries pending. The command succeeded; postflight verified all five exact hashes/timestamps are registered (70 total ledger entries) and the new tables/columns exist. This supersedes the earlier not-applied rollout status above. No application deployment, customer messaging, live customer creation, or credit approval was performed.


## Explicit Net 30 approval follow-up (2026-10-27)

A targeted identity check found Ashish Parikh in both the first/last-name fields and a linked contact on Kelly's Spirits. This resolves the earlier account-name uncertainty; the supplied stakeholder phone still differs from stored numbers. At the user's explicit instruction, this account's approved payment terms were changed from PREPAID to NET30, atomically with a payment_terms_approved activity event. The event records workspace-user authorization via Codex without impersonating an authenticated portal admin. Postflight verified NET30. Existing phone details and the credit limit (0.00) were retained. No customer message was sent. The existing 13 isolated workflow tests, including admin-only terms approval and approval history, passed again. Application UI deployment remains separate from the applied data change.

## Admin terms release follow-up (2026-10-27)

The isolated admin onboarding/terms release passed its production build, TypeScript, and three focused permission/history/concurrency tests. Commit 76ed2a0ef0918f01aabb494f20cf610d6bec1320 was pushed to master through the repository's existing deployment integration. The other stakeholder UI/calculation work remains in this original workspace and is not included in that focused release.

Deployment verification found a target mismatch: GitHub's Vercel integration deploys this repository's master branch to project prj_Vb0e9pwXGm176tSVo1ZChC2lxulR under alex-terrys-projects-d07f6914. The saved mapping names alex-6771s-projects/distribution-portal, project prj_zTRrJvyzsm5AnnRfp41rLaJqrK5l. The saved scope was inaccessible through both connector and CLI. No project settings or integration targets were changed. The user was asked which project is authoritative before treating the automatic release as the intended live portal.

The automatic Vercel deployment dpl_EUv2v2fEaZissaxDuciU7P9QDAjP failed after source compilation and TypeScript passed. Static generation of /admin/accounts and /admin/users/new could not connect to the database (getaddrinfo ENOTFOUND api.neon.tech). The admin UI release is not verified live. No deployment-environment variables or project targets were changed; the intended project must be confirmed first.


## Correct production deployment confirmed (2026-10-27)

The user's screenshot confirms alex-6771s-projects/distribution-portal is authoritative. GitHub deployment 7375602980 subsequently reported success at 2026-10-28T02:33:03Z (October 27, 9:33 PM America/Chicago) for commit 76ed2a0ef0918f01aabb494f20cf610d6bec1320. Correct deployment URL: https://distribution-portal-kkva87z7x-alex-6771s-projects.vercel.app ; Vercel build: https://vercel.com/alex-6771s-projects/distribution-portal/srR7d3DhuYGfhnfgV93LMv4e9qEH . The earlier failed build was the separate Alex Terry project; it did not establish the status of the intended production project. The focused admin terms workflow is now confirmed deployed through GitHub's successful production status. Direct connector access to the intended team still returns 403, so no claim of authenticated admin UI smoke-testing is made. Other stakeholder feature changes remain local and tested, awaiting their separate releases.



## Combined production release verification (October 27, 2026)

Prepared against master 76ed2a0e in the isolated release checkout. Preserved production recipe-email history, trend charts and past-email previews while merging seasonal selection. Added compatibility checks so unchanged legacy payment records and existing driver assignments do not block unrelated operational saves. Inventory synchronization warnings expose a retry control.

Passed: 37 stakeholder tests, 3 admin-terms tests, 12 operator tests, 22 field tests and 18 metrics/report-workflow tests (92 total). Eight browser checks passed for autosave, reload persistence, failures, navigation warnings, retained pending edits, retries, conflicts and lost responses. No customer emails were sent. Production build and exact target deployment are checked separately below.

Production build (`npm run build -- --webpack`), TypeScript, targeted ESLint and staged whitespace checks passed. Existing order-status notification dispatch is preserved after successful writes, with retries queuing no duplicate notification. The exact production deployment must match the authoritative project URL documented in AGENTS.md.
