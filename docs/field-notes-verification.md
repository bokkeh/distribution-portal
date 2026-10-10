# Mobile field notes

Implemented unlinked `/field` with AHAWC/Wisher branding, large controls and no portal sidebar. Normal login and existing role/account permissions apply. Login returns Kim to `/field`; the route is excluded from search indexing. Production target was verified through the signed-in AHAWC browser: alex-6771s-projects/distribution-portal, master, ahawc.com.

## Workflows

- Search accounts by name, city or street, then schedule, create an order/invoice, save a note, upload a photo or record price/inventory independently.
- Add new account from the field search. Only the name is required; location and contact fields are expandable. Normalized duplicate names offer accessible existing accounts without merging them. The existing unique venue key and stable request/account IDs protect concurrent saves and lost-response retries. Sales-representative accounts are assigned to the creator's active sales profile.
- Tasting availability uses declared taster dates plus overlapping bookings. Existing date-only availability is shown as a clearly labeled 4–7 p.m. Eastern window; missing availability is not treated as free. Booking uses the existing venue-timezone-aware scheduler, including Unassigned and conflict checks. Availability refreshes after persistence.
- Orders use whole case quantities, current account pricing and stock validation. Server review precedes an atomic order/invoice/stock/document transaction. Request IDs protect retries and concurrent taps; competing reservations cannot oversell. Check and COD remain unpaid.
- Quick invoices default to saved products with whole case quantities and authoritative account pricing. Product/SKU, quantity, case unit and prices persist as invoice lines; invoices neither require nor reserve inventory and do not create orders. Custom description/amount invoices remain available. Existing administrator/staff permissions are retained; sales representatives can create orders with their invoices. Email is optional at creation, with later email or secure link/PDF sharing. Failed delivery preserves the saved invoice and offers retry.
- Stripe card entry uses the existing Stripe Payment Element and invoice payment/webhook flow. Customer authorization and total are shown. Application code never handles card numbers; payment initialization and browser confirmation do not mark invoices paid. PaymentIntent creation has an idempotency key.
- Notes and photos use existing account records with idempotent retries. Photo uploads use the existing upload endpoint. Failed writes retain input/upload. Price and inventory enrichment fields are expandable on phones.

## Root causes addressed

The full portal required switching between separate account, order, invoice and scheduling screens. There was no shared mobile account context or unlinked field route. Availability was separate from booking. Financial retry identity was absent from the new combined order/invoice transaction. The email helper did not inspect Resend's returned error, which could report failed delivery as sent; it now does.

## Database and configuration

Apply the repository migration chain, including `0078_account_price_history`, `0080_operator_workflows` and new `0081_field_documents`, before rollout. 0081 adds only a request tracking table and index; it does not rewrite historical business data. All migration tests used isolated Postgres. For the authorized release, 0078, 0080 and 0081 were applied atomically to the database whose endpoint/database matched the Vercel production environment. Business row counts before and after were unchanged: 92 orders, 14 invoices, 161 tastings, 155 contacts and 1,772 accounts. No business record, message or payment was created for verification.

Existing invoice public-link secret, Stripe browser/server keys and webhook, Resend email configuration and photo storage must be configured. No new production service or integration dependency was added.

## Verification

- `npm run test:field`: 11 passed, covering authoritative totals, saved-product invoice lines without stock, lightweight account creation/assignment/duplicate matching, duplicate retries, atomic concurrent stock reservations, permissions, optional/later email, delivery failure, card initialization, availability boundaries and idempotent notes/photos.
- `npm run test:operator`: 12 passed, including scheduling visibility/reassignment, independent price/inventory/history, standalone contacts, migration integrity and timezone boundaries.
- `npm run test:field:browser`: passed Chromium touch 390×844 and desktop 1280×844; account search/creation/duplicate selection, scheduling/availability, retained failed accounts/invoices/notes, price-only save, photo upload/save, retained order edits, saved-product and custom invoice review, repeated taps and invoice/email retry.
- `npm run test:operator:browser`: passed both widths; actual scheduling persistence/upcoming refresh and autocomplete selection/dismissal/failure flows.
- `npx tsc --noEmit`: passed. Focused ESLint on all new field actions/components, field libraries/page and shared modified form components: passed.
- Production build: passed in an isolated source directory with network access for existing Google Fonts. Big Shoulders fallback warning remains. The original output directory hit a Windows/OneDrive EPERM lock; it was left intact. Preparation script adjusts only the verification copy's Turbopack root for the dependency junction.

Browser tests exercise real components and server actions against isolated Postgres while mocking authentication/framework, Stripe, upload storage and outbound email boundaries. Real payment/provider delivery, production sessions and physical iPhone Safari were not verified. Mobile screenshots are in `tmp/operator-tests/field-home-390.png` and `field-saved-390.png`.

## Release verification

The signed-in AHAWC browser confirmed production master, bokkeh/distribution-portal and ahawc.com. This resolved the CLI/API account mismatch for target verification. Release prepared from latest remote 36b8a2b to retain production fixes. Exact release checkout passed production build, TypeScript and all 20 database regression tests. Deployment will be verified after Git push.
