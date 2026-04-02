# AHAWC Distribution Portal — Changes Log

## Session Summary (April 2026)

### CRM Module: Website Field & Performance Optimizations

**Database Changes:**
- Migration 0039: Added `website: text` column to `customer_accounts` table
- Migration 0040: Added 4 indexes on frequently-filtered columns:
  - `customer_accounts_user_id_idx` on `user_id`
  - `customer_accounts_hubspot_company_id_idx` on `hubspot_company_id`
  - `customer_accounts_assigned_sales_rep_id_idx` on `assigned_sales_rep_id`
  - `customer_accounts_assigned_region_id_idx` on `assigned_region_id`

**lib/crm/account-read.ts Changes:**
- Removed dynamic column-detection fallback (`getCustomerAccountColumns`, `DEFAULT_ACCOUNT_DETAIL`)
- `getCRMAccountDetail()` now a single direct query returning full `CRMAccountDetail` type
- Simplified codebase, improved maintainability

**actions/crm.ts Changes:**
- **New:** `validateWebsiteUrl()` helper validates http/https URLs, throws on invalid
- **Website field added to:**
  - `createCustomerAccount()` — validates and stores website on create
  - `updateCustomerAccount()` — validates website on update, changed field tracked
  - `mergeCustomerAccounts()` — includes website in field merge
  - `importHubSpotCompany()` — safely imports website with validation fallback
  - `updateHubSpotCompanyAction()` — returns `{ error: string }` on invalid website URL
- **N+1 Query Fix:** `syncHubSpotCompanyContactsToLocalAccount()` refactored:
  - Pre-fetch all contacts once (indexed by email + hubspotContactId)
  - Batch insert new contacts in single query
  - Promise.all() bulk update existing contacts in parallel
  - Returns `{ imported, updated }` counts
- **Optimizations:**
  - Fixed `isPrimary` logic using `hasPrimaryContact` guard (prevents duplicates)
  - Used `.returning()` in `importHubSpotCompany` and `updateCustomerAccount` (eliminated redundant SELECTs)
  - Narrowed SELECT * to projected columns in `syncToHubSpot` and `deleteContact`
  - Removed duplicate `revalidatePath` call

**lib/hubspot/client.ts Changes:**
- `getHubSpotCompanyContacts()` now uses `cache: 'no-store'` instead of `revalidate: 300`
- Ensures fresh contact data on every sync, critical for batch operations

**UI Changes:**
- `components/crm/AccountDetailsCard.tsx`:
  - Added website section with Globe icon
  - URL normalized with https:// if protocol missing
  - Clickable link opens in new tab
- `components/crm/AccountEditForm.tsx`:
  - Added website input field with validation feedback

**Documentation:**
- Created `docs/CODEMAPS/crm.md` — comprehensive CRM module documentation
  - Architecture diagram, data models, data flows
  - Migration documentation, optimization notes
  - Integration points with HubSpot, activity logging, geocoding

---

## Session Summary (March 2026)

---

## Security Hardening

### Critical Fixes
- **Stripe / Resend initialization** — Removed `?? 'sk_test_placeholder'` / `?? 're_placeholder'` fallbacks; both now throw on missing env vars at startup
- **Cron endpoint fail-open** — `app/api/cron/tasting-sms/route.ts` changed from `if (!secret) return true` → `return false` (fail closed)
- **Calendar endpoint auth** — `/api/calendar/tasting/[tastingId]` and `/api/calendar/delivery/[deliveryId]` now require auth; tasters can only download their own ICS
- **GCS folder whitelist** — `lib/gcs/client.ts` added `ALLOWED_FOLDERS` set + `validateFolder()` to prevent path traversal in signed URLs
- **Image proxy** — `/api/image/route.ts` now checks `ALLOWED_PREFIXES` and rejects `..` segments
- **Commission amount validation** — `app/api/commissions/update-amount/route.ts` validates `parseFloat` + `Number.isFinite` + `>= 0`
- **Profile account ownership** — `actions/profile.ts > updateProfile` checks `customerAccounts.userId === userId` before updating

### Auth / Rate Limiting
- **Login rate limiting** — `lib/auth/rate-limit.ts` added Upstash Redis sliding-window limiter (5 attempts / 15 min, keyed by `IP:email`)
- **JWT expiry** — Reduced from `8h` → `4h` in `lib/auth/config.ts`
- **Super admin email** — Moved hardcoded `'alex@ahawc.com'` to `process.env.SUPER_ADMIN_EMAIL`
- **`.env.example`** — Added `SUPER_ADMIN_EMAIL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

---

## Sales Portal Improvements

### 1. Commission Dashboard (`/sales/commissions`)
- New page showing KPI cards: Total Paid, Approved, Pending, Total Earned
- Visual pipeline bar with percentage breakdown
- Full commission history with status badges (pending/approved/paid/voided), type labels, linked order info, paidAt timestamps
- Added **Commissions** nav link to SalesNav (`DollarSign` icon)

### 2. Order History Timeline on Account Detail
- `app/(sales)/sales/accounts/[accountId]/page.tsx` upgraded from flat list to vertical timeline
- Shows status color-coded dots (green=fulfilled, blue=confirmed, amber=pending, red=cancelled)
- Per-order metadata: item count, shipping status, invoice number
- Queries `orderItems` for counts and `invoices` for invoice numbers

### 3. Map Popup Visit Health
- `components/regions/RegionsMap.tsx` — `AccountInfoCard` popup now shows:
  - Visit Health label (Healthy / Due soon / Overdue / At risk / Critical)
  - Color-coded staleness progress bar
  - "Last visit: Xd ago" + "Nd overdue / Next: Nd" labels
- Health color uses the time-decay model (staleness = daysSinceVisit / visitFrequency, 5-band gradient)

### 4. Mobile Check-In Flow
- **`CheckInModal.tsx`** — Replaced `LogVisitButton` with a mobile-friendly bottom-sheet modal
  - Notes textarea with "What did you discuss?" prompt
  - Confirmation state with success animation
  - Closes automatically after 1.8s on success
- **`actions/sales-members.ts > logVisit`** — Now accepts optional `notes`, logs an `activity_event` record with `kind: 'visit_logged'`

### 5. Reorder Suggestions
- `app/(sales)/sales/accounts/page.tsx` — Added amber "Reorder Follow-ups" banner at top of accounts page
- Shows accounts that haven't ordered in 30+ days (up to 5)
- Shows "Xd ago" or "Never ordered" alongside each account name

### 6. Proof of Delivery (pre-existing, documented)
- Already implemented in `components/deliveries/DriverStopCard.tsx`
- Upload tiles for Proof of Delivery, Shelf Photo, and 5 additional photos
- Camera icon upload with loading state and toast feedback

### 7. Tasting ROI (`/sales/tastings`)
- New page comparing 60-day revenue before vs after each tasting per account
- KPI cards: Total Tastings, Revenue Lift, Avg Lift %, Positive Impact ratio
- Per-account before/after revenue tiles with lift percentage
- Full tasting history list at bottom
- Added **Tastings** nav link to SalesNav (`Wine` icon)

### 8. Route Optimization (pre-existing, documented)
- Already implemented via `optimizeSalesRouteOrder` server action
- "Generate Best Route" button in `SortableSalesStopList.tsx` with `Sparkles` icon
- Uses nearest-neighbor algorithm from current origin

### 9. Daily Digest Email (`/api/cron/daily-digest`)
- New cron route: `GET /api/cron/daily-digest` (requires `Bearer CRON_SECRET`)
- Fetches all active sales reps, sends personalized morning briefing email containing:
  - Overdue visits (red)
  - Visits due this week (amber)
  - Reorder follow-ups (up to 5 accounts 30+ days since last order)
  - Pending commissions total
- Added `sendSalesRepDigestEmail()` to `lib/resend/client.ts`

### 10. Sales Forecasting (`/sales/forecast`)
- New page with 9-month revenue history + 3-month linear trend projection
- CSS bar chart rendered client-side (`RevenueTrendChart.tsx`)
- KPI cards: Last Month, Last 3 Months, Last 6 Months, Projected Next 3 Mo
- Top 8 accounts by revenue (last 6 months) with horizontal progress bars
- Added **Forecast** nav link to SalesNav (`TrendingUp` icon)

### 11. HubSpot Two-Way Sync (`/api/cron/hubspot-sync`)
- New cron route that pulls contact updates from HubSpot (changed in last 24h)
- Matches portal contacts by `hubspotContactId`
- Updates `name`, `email`, `phone`, `title` when HubSpot has newer values
- Added `fetchHubSpotContactsUpdatedSince(sinceMs)` to `lib/hubspot/client.ts`

### 12. Tastings Scheduling Assistant
- `actions/tastings.ts > getTastingScheduleSuggestions(accountId)` — server action
  - Returns up to 5 optimal weekday slots in next 45 days
  - Skips days with existing tastings for the account
  - Filters for available tasters (not already booked)
  - Labels conflict count for transparency
- `components/tastings/TastingScheduleAssistant.tsx` — client component
  - "Suggest Dates" button that calls the action
  - Shows date suggestions with available taster names and "Best pick" badge
  - "Use" button fills in the date field in the create-tasting form
- Wired into `TastingsPlanner.tsx` — appears after account is selected

### 13. Superadmin View-As-User
- `actions/view-as.ts` — `startViewAsUser(userId)` sets `__portal_view_as` cookie (1h TTL); `stopViewAsUser()` clears it; both superadmin-only
- `lib/auth/session.ts > requireRole` — overlays viewed user's id/roles when cookie is set, so all portal pages render as that user
- `components/admin/ViewAsButton.tsx` — client button on user detail page (only shown for superadmin)
- `components/admin/ViewAsBanner.tsx` — fixed top banner (violet) showing "Viewing portal as [Name]" with "Exit View" button
- `components/admin/ViewAsProvider.tsx` — server component reads cookie, renders banner if active
- Banner wired into `app/(sales)/layout.tsx`; can be added to other portal layouts similarly

---

## Navigation Changes (SalesNav)
New nav items added:
| Route | Label | Icon |
|---|---|---|
| `/sales/tastings` | Tastings | Wine |
| `/sales/forecast` | Forecast | TrendingUp |
| `/sales/commissions` | Commissions | DollarSign |

---

## UI / Layout Changes
- **TasterSidebar** — Desktop nav redesigned: horizontal pill links, notification bell + icon-only profile/sign-out grouped on right
- **SuperAdminViewSwitcher** — Removed from TasterSidebar nav; now floats fixed bottom-left (`fixed bottom-4 left-4 z-50 w-52`) for superadmins
- **Admin layout** — Removed `TestSmsBar` component
- **Taster hourly rate** — New `tasterHourlyRate` column on `users` table; `TasterRateCard` shown on admin user detail for tasters; `submitTasterInvoice` fetches rate from DB (removed from form input)
- **Call drawer** — `drawerOpen` state added to `CallContext`; drawer persists after call ends; X button added; floating "CALL" tab re-opens closed drawer

---

## Database Schema Changes
- `users.tasterHourlyRate` — `numeric(10,2)` column added (via `db:push`)

## New Files
| File | Purpose |
|---|---|
| `app/(sales)/sales/commissions/page.tsx` | Commission dashboard |
| `app/(sales)/sales/tastings/page.tsx` | Tasting ROI page |
| `app/(sales)/sales/forecast/page.tsx` | Sales forecast page |
| `app/(sales)/sales/forecast/RevenueTrendChart.tsx` | Client bar chart |
| `app/(sales)/sales/accounts/[accountId]/CheckInModal.tsx` | Mobile check-in modal |
| `app/api/cron/daily-digest/route.ts` | Daily digest cron |
| `app/api/cron/hubspot-sync/route.ts` | HubSpot two-way sync cron |
| `actions/view-as.ts` | View-as session override actions |
| `components/admin/ViewAsBanner.tsx` | View-as floating banner |
| `components/admin/ViewAsButton.tsx` | User detail page trigger |
| `components/admin/ViewAsProvider.tsx` | Server component for banner |
| `components/tastings/TastingScheduleAssistant.tsx` | Scheduling assistant UI |
| `lib/auth/rate-limit.ts` | Upstash Redis rate limiter |

---

## Environment Variables Added
```
SUPER_ADMIN_EMAIL=alex@ahawc.com
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## Cron Jobs to Configure (Vercel)
```
# Daily digest — 7am ET on weekdays
0 12 * * 1-5   GET /api/cron/daily-digest   Bearer CRON_SECRET

# HubSpot sync — every 6 hours
0 */6 * * *    GET /api/cron/hubspot-sync   Bearer CRON_SECRET
```
