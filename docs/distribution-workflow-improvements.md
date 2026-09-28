# Distribution workflow improvements

This release is isolated on `codex/distribution-workflow-improvements`, based on the latest remote master. It contains only the requested workflow updates. Pre-existing Events and tasting-economics work remains in the original workspace and is excluded from this release. Production is unchanged.

## Changed files and reused components

- `components/tastings/TasterTeamPanel.tsx`: available names open an accessible Radix drawer containing the existing `TastingScheduleBoard`. The taster and date are prefilled. Availability has only date-level data, so the suggested window is 4–7 PM Eastern, with both times editable. The selected month is retained after saving.
- `components/tastings/TastingsPlanner.tsx`: shared form supports the availability drawer and existing account locations; Past/Previous Tastings supports live account-name search, most recent tasting dates, and stored bottles sold / samples served. Existing date/taster filters, status controls and report/detail links remain.
- `actions/tastings.ts`, `lib/tastings/read.ts`, `lib/tastings/locations.ts`, `lib/tastings/windows.ts`: normal tasting records and existing conflict checks are reused, with account-name/result reads and location selection added. Fixed an existing invalid availability-month boundary (the 31st was used even for 30-day months and February).
- Admin and staff tasting pages pass account locations, booking context and feedback to the shared components. The shared scheduling form uses unique input IDs because the staff page can display it both in a drawer and on the page.
- `components/tasks/TaskList.tsx`, `lib/tasks/read.ts`, `lib/tasks/sort.ts`: compact list rows, active tasks first, predictable due-date/id sorting, completed tasks hidden by default, and a Show/Hide Completed toggle. Completion/status/edit/delete controls remain. Details disclose descriptions, creator/contact, and completion date. The database query ranks active work before applying its existing 200-row limit.
- `components/orders/OrderOperations.tsx`, `OrderDeliveryDateForm.tsx`, `OrderPoUpload.tsx`, `actions/order-delivery.ts`, and admin/staff order detail pages: separate order/delivery dates, delivery-based due-date guidance, and optional PO files with upload metadata.
- `app/api/orders/[orderId]/po/route.ts` and `po/[documentId]/route.ts`, `lib/orders/po-files.ts`, `lib/gcs/client.ts`: existing Google Cloud storage, signed reads, upload rate limiting, and cleanup helpers are reused. PO storage is isolated from the unauthenticated image proxy. Admin/staff with the Orders feature can upload/view/download documents for their order.
- `actions/quick-add.ts`, `components/quick-add/GlobalQuickAdd.tsx`: ZIP uses the existing account `zip` field. Tasting suggestions use 4–7 PM, and Quick Add tasting times now use the existing Eastern-time conversion helper. The taster missing-entry form and its server fallback also suggest 4 PM.
- `tests/distribution-workflows.test.ts`: calendar/payment terms, sorting/completion, PO validation, locations and scheduling overlap regression tests.

## Database changes and new fields

`0073_distribution_workflows.sql` adds only:

- Nullable `orders.delivery_date` (date). No creation date or existing payment data is changed, and no existing order is backfilled.
- `order_documents`: order ID, filename, storage path, content type, uploader user ID, upload timestamp, and an order index. PO documents remain optional; multiple files are supported. Uploader deletion preserves documents and displays Former user.

The isolated release journal registers only 0073; unrelated local 0071/0072 migrations are excluded. No migrations were applied during this task. Apply the additive schema changes before deploying code that reads the new column/table. No production records were created, changed or deleted during verification.

ZIP and due date are not duplicate stored fields: ZIP is reused; the order due date is derived from delivery date and order terms.

## Accounting rules and assumptions

- Net terms start from the saved delivery date. No delivery date means no calculated order due date. Net 15 on September 20 produces October 5. COD / Due on Receipt use delivery day; 2/10 Net 30 uses the final 30-day deadline. Prepaid and unknown/custom terms have no calculated date.
- Existing invoice dates remain authoritative and are not overwritten. Relevant accounting code: `actions/invoices.ts` accepts a manually supplied due date, and `app/api/cron/invoice-payment-reminders/route.ts` uses the stored invoice date. Converting invoices/reminders to automatic delivery-based dates would change existing accounting behavior and needs a separate business decision.
- Last tasting is the most recent past scheduled, confirmed or completed tasting for the account, independent of visible date/taster filters. Cancelled, declined and requested records do not replace it. Historical records without a report are not proof of actual attendance; existing missing-report badges remain visible.
- Existing account same-day limits and training-day exception remain, including for additional account locations. Availability provides dates only, not granular time windows.
- POs allow PDF, JPG/JPEG, PNG, WebP, DOC and DOCX up to 4 MB, with extension/header validation. Word files download rather than render inline. This is format validation, not malware scanning. The GCS bucket must remain private.

## Verification and remaining manual tests

Passed in the original workspace: production Next.js build, TypeScript checks, targeted ESLint checks, and 27 relevant regression tests. The isolated release also passes its production build, TypeScript checks, targeted ESLint, and all 12 workflow/availability regression tests. Local production verification uses a temporary Turbopack filesystem-root override for the shared dependency junction, then restores the original config. A normal Vercel install has no junction and needs no override. A temporary synthetic UI fixture verified live account search, last-tasting selection, hidden/completed task behavior, availability drawer prefill, alternate locations, editable times, and a September 20 delivery producing October 5 while the order date remains unchanged. These component saves were mocked and are not live database/storage end-to-end tests.

Real built routes reject unauthenticated tasting/task/PO access, and the public image proxy returns 403 for the PO folder.

Before production release, use an authenticated nonproduction session with migrated schema to verify:

1. Search real account histories and open the latest report/details on desktop and mobile.
2. Book through availability, confirm the drawer closes and selected-month coverage refreshes, and reject a same-taster overlapping booking. Confirm existing training-day rules.
3. Create an order with blank delivery date, reload, add a delivery date, reload, clear it, and verify original order date/payment/invoice data remain unchanged.
4. Upload/view/download a real MOCO PO, confirm filename/uploader/date, reject oversized or mismatched files, and confirm unauthorized users cannot access its route.
5. Quick Add an account with ZIP and check the normal account record.
6. Complete/reopen/edit a task; confirm sorting, hidden-completed behavior and preserved details after reload.

Full authenticated end-to-end writes were not run: the portal requires authentication/age verification and the pending migrations. Synthetic checks sent no notifications and did not touch production data.

## Risks and edge cases

- Existing scheduling validation checks for conflicts before insertion but has no database-level concurrency lock. Two simultaneous submissions can still race; this pre-existing limitation remains.
- The availability UI retains the existing weekend-only and whole-day coverage view, so a taster with a booking is not shown as open for other times that day.
- The existing task query limit remains 200 per scope; older completed records may be outside the fetched view. No tasks are auto-archived or deleted.
- Manual invoice dates can differ from delivery-based order guidance. Changing that behavior requires accounting agreement.
- The configured AHAWC Vercel project/team is inaccessible to the current CLI and connector account (403 Forbidden). That account has access to another team with a same-named project, which is not this deployment target. Production deployment and schema migration remain pending correct AHAWC team access.
