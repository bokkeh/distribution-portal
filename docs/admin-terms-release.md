# Admin payment-terms release

This release adds CRM account → Onboarding & terms for admin approval and adjustment of payment terms. Staff can capture requests, referrals, onboarding notes and manual WhatsApp follow-up without granting credit. Approvals require a reason, compare previous terms to prevent stale overwrites, and write the account change and approval history atomically. Existing terms are selected by default. New accounts and HubSpot-company conversions start prepaid; requested credit terms are recorded separately.

The five stakeholder migrations (0085–0089) are included as source records for the migrations already applied to the configured portal database. This release activates only the onboarding/terms workflow; the other stakeholder UI and calculation changes remain in the original workspace for separate releases.

Validation: isolated tests verify requests cannot grant terms, staff cannot approve, admin changes record actor and history, stale approvals fail, invalid terms and missing reasons fail, and admins can adjust previously approved terms. TypeScript passes. Targeted lint has no errors; the existing unused movedTastings binding in actions/crm.ts remains a warning.

Ashish Parikh was verified against the existing Kelly's Spirits account and linked contact. Explicit user authorization changed approved terms from PREPAID to NET30 with an audit record. Phone details and the $0 credit limit were retained. No customer message was sent.

Remaining stakeholder work:

- Release the tested order autosave/driver changes, shared economics and sales ROI repairs, tasting summaries, historical purchase corrections/history, contact email/history, and recipe management.
- Reconcile Kensington's seven records, five completed statuses, six populated bottle-count reports and two approved invoices ($165); obtain missing actual costs. Do not silently rewrite event statuses or invent missing attribution.
- Supply approved Wisher Autumn Sunrise ingredients/instructions and identify the intended tasting/date. Its empty draft is unpublished.
- Confirm the Resend webhook subscriptions for confirmed delivery/failure reporting, then smoke-test using a sandbox recipient rather than a live customer.
- Confirm whether Kim means the existing career progression level or wants a separate competitive sales rank. A leaderboard needs a metric, comparison group and reporting period.
- Confirm WhatsApp follow-up is desired; current support is a manual contact link and follow-up tracking, not automated provisioning or outreach.

Vercel connector and CLI cannot access the configured team directly. Deployment uses the existing GitHub master → alex-6771s-projects/distribution-portal integration. Production success must be checked against the exact pushed commit in GitHub's Vercel status.
