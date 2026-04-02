# Distribution Portal — Codemap Index

**Last Updated:** 2026-04-02
**Project:** AHAWC Liquor Distribution Portal
**Tech Stack:** Next.js 16 + TypeScript + Tailwind CSS, Neon PostgreSQL, Drizzle ORM, NextAuth v5, HubSpot API

## Overview

This document maps all major system areas of the distribution portal. Each area has detailed architecture documentation in its own codemap file.

## System Areas

### 1. CRM Module (`docs/CODEMAPS/crm.md`)
**Status:** Active — Website field added (April 2026)
- Account management (create, update, merge)
- Contact management (add, update, delete)
- HubSpot bi-directional sync
- Activity event logging
- Website validation and display

**Key Files:**
- `actions/crm.ts` — Server actions for all CRM operations
- `lib/crm/account-read.ts` — Account query helpers
- `components/crm/*` — UI components for account/contact forms and display
- `db/schema/customers.ts` — Drizzle schema with customer accounts

**Recent Optimizations:**
- Eliminated N+1 contact sync loop with batch pre-fetch + bulk operations
- Added 4 indexes on `customer_accounts` for query performance
- Used `.returning()` to eliminate redundant SELECTs
- Website field validation with http/https enforcement

---

### 2. Database Layer
**Files:** `db/schema/*.ts`, `db/migrations/*.sql`

**16 Core Tables:**
1. `users` — All user accounts (customers, staff, drivers, admins)
2. `customer_accounts` — CRM accounts (addresses, licensing, HubSpot sync)
3. `contacts` — Account contacts with HubSpot linking
4. `products` — Catalog items
5. `inventory` — Stock levels
6. `orders` — Customer orders
7. `order_items` — Line items in orders
8. `invoices` — Order invoicing
9. `accounts` — Chart of accounts (GL)
10. `journal_entries` — GL posting
11. `journal_entry_lines` — GL line items
12. `drivers` — Driver profiles
13. `deliveries` — Delivery routes
14. `delivery_stops` — Individual stop records
15. `notifications_log` — SMS/email audit trail
16. Plus: tastings, tasting_reports, taster_invoices, sales routes, activity events, etc.

**Migration Strategy:** Drizzle ORM with `drizzle-kit push` for development
- Migrations tracked in `db/migrations/` with sequential naming (0000_*, 0001_*, ...)
- Latest: `0040_customer_accounts_indexes.sql` (April 2026)
- Repair scripts available: `db/repair-platform-ops.ts`, `db/repair-migration-history.ts`

---

### 3. Authentication & Authorization
**Files:** `lib/auth/config.ts`, `lib/auth/session.ts`, `middleware.ts`

**Architecture:**
- NextAuth v5 with JWT + Credentials provider
- 4 user roles: `admin`, `staff`, `driver`, `customer`
- JWT expiry: 4 hours (March 2026 hardening)
- Rate limiting: 5 login attempts per 15 minutes via Upstash Redis

**Role-Based Access:**
- `/admin/*` — Platform admins (user management, financial reporting)
- `/staff/*` — Internal staff (CRM, inventory, order management)
- `/driver/*` — Delivery drivers (route tracking, proof of delivery)
- `/customer/*` — Customer portal (orders, account details, invoices)

---

### 4. External Integrations

#### HubSpot API (`lib/hubspot/client.ts`)
- Bi-directional sync of companies and contacts
- Contact fields: name, email, phone, title, job title
- Company properties: name, phone, address, city, state, zip, website, industry
- Primary contact selection with duplicate prevention logic
- Fresh contact fetches with `cache: 'no-store'` (April 2026)

#### Stripe Payment Processing
- API version: `2026-02-25.clover` (Clover POS integration)
- Order payment processing and refunds
- Commission tracking (linked to sales reps)
- Initialization fails on missing `STRIPE_SECRET_KEY` (hardened March 2026)

#### Twilio SMS
- Customer notifications for orders, tastings, deliveries
- SMS thread tracking with reply handling
- Tasting reminder series automation

#### Resend Email
- Invoice email notifications
- Tasting invitations
- Sales team daily digest emails
- Initialization fails on missing `RESEND_API_KEY` (hardened March 2026)

#### Google Cloud Storage
- Proof of delivery photos (driver uploads)
- License document storage
- Tasting reports
- Signed URL generation with folder whitelist validation (hardened March 2026)

#### Google Maps JavaScript API
- Server-side geocoding for account addresses
- Client-side address lookup and directions links
- Region visualization with account overlays

#### Google Chat Webhooks
- Post alerts to team channels for critical events
- Rate limiting per channel

---

### 5. Sales Portal (`/sales/*`)
**Core Pages:**
- `/sales/accounts` — Account list with visit health, reorder suggestions
- `/sales/accounts/[accountId]` — Account detail with order timeline
- `/sales/tastings` — ROI analysis (60-day before/after revenue)
- `/sales/forecast` — 9-month trend with 3-month projection
- `/sales/commissions` — Commission dashboard with status tracking

**Features:**
- Order history timeline with status indicators
- Route optimization (nearest-neighbor algorithm)
- Tasting scheduling assistant with 45-day lookahead
- Mobile check-in modal with notes capture
- Activity event logging (visits, calls, etc.)
- Superadmin view-as-user mode for support/debugging

---

### 6. Admin Portal (`/admin/*`)
**Core Pages:**
- `/admin/crm` — Accounts and contacts list with merge capability
- `/admin/crm/[accountId]` — Account detail, edit, HubSpot import
- `/admin/users` — User management and role assignment
- `/admin/inventory` — Stock levels and reorder tracking
- `/admin/orders` — Order approval workflow
- `/admin/tastings` — Tasting scheduling and availability
- `/admin/financial` — GL reporting, journal entries

**Features:**
- Account merge with cascading updates to orders, invoices, tastings, etc.
- Contact merge with de-duplication
- HubSpot company import with contact sync
- Manual visit logging
- Taster availability management
- View-as-user impersonation (superadmin only)

---

### 7. Staff Portal (`/staff/*`)
**Core Pages:**
- `/staff/crm` — Simplified CRM view (read-mostly)
- `/staff/orders` — Order management without approval authority
- `/staff/deliveries` — Delivery tracking and coordination

**Constraints:**
- Cannot delete or merge accounts
- Cannot approve orders (admin-only)
- Cannot adjust pricing tiers

---

### 8. Driver Portal (`/driver/*`)
**Core Pages:**
- `/driver/routes` — Assigned delivery routes for the day
- `/driver/stops` — Stop details with delivery tracking
- `/driver/proof` — Upload proof of delivery and shelf photos

**Features:**
- GPS navigation integration
- Photo upload with image optimization
- Signature/confirmation per stop
- Real-time route status updates

---

### 9. Customer Portal (`/customer/*`)
**Core Pages:**
- `/customer/orders` — View all orders with status
- `/customer/invoices` — Download invoices and payment history
- `/customer/account` — Update delivery preferences, contact info, hours

**Features:**
- Order tracking from confirmation to delivery
- Invoice PDF download
- Notification preference management
- Delivery time slot preferences

---

### 10. Background Jobs & Cron Routes
**Cron Endpoints (Vercel):** Require `Bearer CRON_SECRET`

1. **Daily Digest** — `GET /api/cron/daily-digest` (7am ET weekdays)
   - Fetch all active sales reps
   - Send overdue visits, weekly agenda, pending commissions

2. **HubSpot Two-Way Sync** — `GET /api/cron/hubspot-sync` (every 6 hours)
   - Pull updated contacts from HubSpot (changed in last 24h)
   - Update local `name`, `email`, `phone`, `title` if HubSpot is newer

3. **Tasting SMS Series** — Automated SMS reminders (pre-existing)
   - Day-before reminder
   - 1-hour reminder

---

## Technology Stack Summary

### Frontend
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui components
- **State Management:** React hooks (Context for call modal, view-as-user)

### Backend
- **Runtime:** Node.js (Vercel deployment)
- **ORM:** Drizzle ORM
- **Database:** Neon PostgreSQL (fully managed)
- **Auth:** NextAuth v5 with JWT

### External Services
- **Payments:** Stripe API v2026-02-25.clover
- **SMS:** Twilio
- **Email:** Resend
- **Files:** Google Cloud Storage
- **Maps:** Google Maps JS API
- **Webhooks:** Google Chat
- **CRM:** HubSpot API
- **Rate Limiting:** Upstash Redis

### Infrastructure
- **Hosting:** Vercel
- **Database:** Neon (managed PostgreSQL)
- **Cron Jobs:** Vercel Cron
- **Environment Secrets:** Vercel environment variables

---

## Key Architectural Patterns

### Server Actions Pattern
All data mutations via `'use server'` functions in `actions/*.ts`:
- Form submission handlers returning success/error objects
- Database operations with transaction rollback support
- Activity event logging on mutations
- Path revalidation for affected pages

### Query Optimization
- Projected column selection (avoid SELECT *)
- Indexed columns for frequently-filtered queries
- Batch operations with Promise.all() parallelization
- `.returning()` to eliminate redundant SELECTs
- Response caching strategy per endpoint (e.g., `cache: 'no-store'` for HubSpot sync)

### Activity Audit Trail
Every user-initiated mutation logged to `activity_events` table:
- `entityType`, `entityId` (what was modified)
- `kind` (account_created, contact_merged, etc.)
- `title`, `body` (human-readable summary)
- `metadata` (before/after values, changed fields)
- `createdAt`, `actorUserId` (who did it)

### HubSpot Integration
- Account = HubSpot Company
- Contact = HubSpot Contact
- Bi-directional sync with local fields as source of truth
- Primary contact selection with guards to prevent duplicates
- Website validation (http/https only) on import and update

---

## Setup & Deployment

### Local Development
```bash
npm install
npm run db:push          # Push schema to Neon
npm run db:seed          # Seed admin user + chart of accounts
npm run dev              # Start dev server on :3000
```

### Environment Variables (see `.env.example`)
- `DATABASE_URL` — Neon PostgreSQL connection
- `NEXTAUTH_SECRET` — JWT signing key
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `RESEND_API_KEY`
- `HUBSPOT_API_KEY`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (rate limiting)
- `CRON_SECRET` — Cron job bearer token
- `GOOGLE_MAPS_API_KEY`
- `GCS_BUCKET`, `GCS_PROJECT_ID`, `GCS_PRIVATE_KEY`
- `GOOGLE_CHAT_WEBHOOK_URL`
- `SUPER_ADMIN_EMAIL` (hardened March 2026)

### Deployment (Vercel)
- Auto-deploys from main branch
- Cron jobs configured in Vercel dashboard
- Environment secrets managed via Vercel UI
- Database migrations via `npm run db:push` before deploy

---

## Performance Optimizations (April 2026)

1. **Database Indexes:** 4 new indexes on `customer_accounts` for sales rep, region, and HubSpot queries
2. **Batch Contact Sync:** Eliminated N+1 loop in `syncHubSpotCompanyContactsToLocalAccount()`
3. **Eliminated Redundant SELECTs:** Used `.returning()` in create/update operations
4. **Narrowed Projections:** Only select needed columns instead of SELECT *
5. **Fresh API Calls:** Changed HubSpot contact fetch from 5-minute cache to `cache: 'no-store'`

---

## Current Known Limitations

- One-to-one account-to-primary-contact relationship (HubSpot convention)
- Website URL must be http or https (ftp, etc. not allowed)
- Stripe API version locked at `2026-02-25.clover` for Clover POS compatibility
- Superadmin view-as-user TTL limited to 1 hour for security
- HubSpot two-way sync only updates name, email, phone, title (others are local source of truth)

---

## Codemap Files

- `docs/CODEMAPS/crm.md` — CRM module (accounts, contacts, HubSpot sync)
- `docs/CODEMAPS/INDEX.md` — This file (system overview)

*Additional codemaps for sales, admin, database, and integrations can be expanded as needed.*
