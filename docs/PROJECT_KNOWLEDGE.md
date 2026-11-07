# Distribution portal project knowledge

## Production identity

Repository: https://github.com/bokkeh/distribution-portal.git. Production branch: master.

Authoritative Vercel project: https://vercel.com/alex-6771s-projects/distribution-portal

- Project ID: prj_zTRrJvyzsm5AnnRfp41rLaJqrK5l
- Team ID: team_wUEjIsiSNqDRGcvEoBVwSJab
- Confirmed by user screenshot on October 27, 2026.
- The separate Alex Terry project (prj_Vb0e9pwXGm176tSVo1ZChC2lxulR) is not the intended target. Its database/build errors must not be attributed to the production portal.
- GitHub status contexts collide. Read all commit statuses and match the authoritative Vercel project URL before declaring success or failure. Do not change project settings or deploy to another project after an authorization error.
- Successful admin-terms release: commit 76ed2a0ef0918f01aabb494f20cf610d6bec1320, deployment https://vercel.com/alex-6771s-projects/distribution-portal/srR7d3DhuYGfhnfgV93LMv4e9qEH . The other project's build failed, but this production project succeeded.

## Stakeholder decisions and data

- Migrations 0085–0089 were applied and their exact hashes verified in the configured portal database. Do not repair or seed the migration ledger blindly.
- Ashish Parikh is linked to Kelly's Spirits. The user explicitly approved NET30; it was recorded atomically with approval history. The credit limit remains $0 and phone information was not changed. Approval of terms is separate from a credit-limit change.
- Net 30 requests do not grant credit automatically. Admins adjust approved terms under CRM account → Onboarding & terms, with a reason and history; staff can capture requests.
- Kensington has seven completed tasting records, six reports with bottle counts, and two approved invoices totaling $165. Kim confirmed that the August 22 and October 3, 2026 tastings were completed and their reports submitted; those two statuses were corrected atomically with audit history on October 27, 2026. The November 23, 2024 tasting still has no bottle/sample counts; Kim is asking Connor for the missing numbers. Do not invent costs, counts or causation.
- Tasting attribution requires a recorded event link or documented override. Missing attribution is unknown, not organic. Contribution-per-case and legacy 12-bottle pack-size fallbacks are estimates. A timing window alone does not prove tasting ROI.
- My Rank currently means the Wisher assigned career progression level. A competitive leaderboard requires an agreed metric, comparison group and reporting period.
- Wisher Autumn Sunrise was not found in the public approved catalog. Its database record is an empty unpublished draft. Obtain approved ingredients/instructions and the specific intended tasting/date before publishing or assigning it.
- WhatsApp is a manual contact link and follow-up workflow, not automated provisioning. Do not send customer messages without explicit recipient/content/channel authorization.
- Email provider acceptance is not confirmed delivery. Resend signed delivery/failure events establish supported statuses; older missing communication records must not be fabricated.

## Release process

Preserve unrelated uncommitted work in the primary checkout. Prepare scoped releases against current master in an isolated checkout. Merge relevant feature changes with newer production changes instead of replacing newer files wholesale. Verify migrations, tests and build before pushing. Verify the exact commit's intended Vercel deployment afterward. No live customer message should be used for development verification.

See stakeholder-workflows-verification.md for detailed feature, calculation, migration and verification notes. Remaining source-data and approved-content decisions should stay explicit even after application deployment.


## Taster invoice approval repair (2026-11-05)

Kristen Buser's account is active with admin/staff roles and invoicing access. No permission change was needed. approveTasterInvoice selected users.id without joining users, causing Drizzle to reject the query before approval. Select the same assigned user ID directly from the already joined tastings table; unassigned tastings remain approvable. Approval authorization, invoice amounts, paid statuses and Stripe payout behavior are unchanged. Four isolated regression tests reproduced the failure before the fix and passed afterward: administrator approval/reopening, staff approval of an unassigned tasting, preserving paid invoices, and denying sales-only approval. Scoped ESLint passed. No live invoice was approved or paid for testing, and no user role was changed.


## Field Notes account-note history (2026-11-06)

The mobile account task is now Account notes, showing existing account_notes rows with author, recorded date/time, preserved line breaks and pinned-first/newest ordering. The quick-note writer remains on the same screen and refreshes history after a confirmed save. Refresh failures retain loaded notes and clearly identify them as stale; empty accounts have an explicit empty state. The server verifies existing field account scope before reading notes, so sales representatives cannot read another rep's account. No new notes store, permission grant, migration or provider is introduced. Four isolated note-history tests and 23 existing Field Notes tests passed; Chromium touch 390x844 and desktop 1280x844 passed previous-note display, retained refresh failure, save and reopening. Scoped lint and TypeScript passed. Authentication/provider boundaries were mocked; physical iPhone Safari was not tested. No production note or invoice was created for verification. This release preserves the current mobile tasks/order navigation and other master changes.


## Weekly recipe email engagement (2026-11-06)

Added unique opens, click-through, engagement and click-to-open rates, trend charts, per-send history columns, recipient open/click timestamps and clicked marketing destinations. Uses purpose-signed first-party pixels/redirects and the existing activity_events ledger with deterministic IDs; repeated opens/clicks do not inflate unique recipients. HTML and plaintext marketing links are tracked; previews, unsubscribe URLs and List-Unsubscribe headers remain unchanged. Valid marketing links redirect even during analytics outages. No schema migration, new provider, widened role access or new secret is required. Signing reuses the existing community-email signing-secret fallback with a distinct purpose. Existing Resend delivery/unsubscribe workflows stay intact.

Rates explicitly use accepted recipients (not invented inbox deliveries), aggregate by total recipients rather than average percentages, and count open-or-click union once. Click-to-open measures recorded openers who also clicked. Tracking begins with future sends; historical sends display Not tracked and are excluded from summary rates. The installed Resend key was confirmed send-only via read-only API calls; it cannot retrieve provider history or change provider tracking. No provider configuration was modified. Image blocking, privacy proxies, forwarding and security scanners limit what observed signals prove; the UI explains this. No IP/user-agent tracking is stored.

Five pure token/rate/content tests, five isolated database/route tests, mobile Chromium at 390px and desktop at 1440px, scoped ESLint, TypeScript and production build passed. Tests covered signature tampering, unsafe/wrong-purpose links, concurrent replay, zero vs unknown, weighted rates, first timestamps, cache controls, unsubscribe preservation and outage redirects. No real email was sent and no production contact, subscription, campaign count, invoice or inventory was changed for verification. See docs/recipe-email-engagement.md for definitions and commands. Physical email-client delivery/image loading remains unverified.

## Draft invoices and field resending (2026-11-07)

User explicitly approved implementation and production deployment. See docs/invoice-workflow.md for behavior and validation. New orders save invoices automatically; emailing remains an explicit review/send action, and resending keeps the same invoice number with an editable recipient. Existing historical orders are not bulk-backfilled or emailed. Target remains alex-6771s-projects/distribution-portal from master; release verification is pending. No migration is required.
