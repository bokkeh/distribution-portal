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
