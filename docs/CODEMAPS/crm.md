# CRM Module Codemap

**Last Updated:** 2026-04-02
**Entry Points:** `/admin/crm/*`, `/staff/crm/*`
**Key Files:** `actions/crm.ts`, `lib/crm/account-read.ts`, `components/crm/*`, `db/schema/customers.ts`

## Architecture

```
┌─────────────────────────────────────┐
│   CRM UI Layer (Admin/Staff)        │
│  ├─ AccountDetailsCard.tsx          │
│  ├─ AccountEditForm.tsx             │
│  └─ [contact components]            │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Server Actions (actions/crm.ts)   │
│  ├─ updateCustomerAccount()         │
│  ├─ createCustomerAccount()         │
│  ├─ importHubSpotCompany()          │
│  ├─ updateHubSpotCompanyAction()    │
│  ├─ syncToHubSpot()                 │
│  ├─ syncHubSpotCompanyContactsToX() │
│  └─ [contact management actions]    │
└──────────────┬──────────────────────┘
               │
   ┌───────────┼───────────┬──────────┐
   │           │           │          │
┌──▼──┐  ┌────▼────┐ ┌────▼────┐ ┌──▼─────────┐
│  DB │  │ HubSpot │ │ Activity │ │  Geocoding │
│ ORM │  │  API    │ │  Logger  │ │   Service  │
└─────┘  └─────────┘ └─────────┘ └────────────┘
```

## Key Modules

| Module | Purpose | Key Exports | Dependencies |
|---|---|---|---|
| `actions/crm.ts` | Server actions for account & contact management | `updateCustomerAccount`, `createCustomerAccount`, `importHubSpotCompany`, `updateHubSpotCompanyAction`, `syncToHubSpot`, `mergeCustomerAccounts`, `mergeContacts`, `addContact`, `updateContact`, `deleteContact` | `drizzle-orm`, `lib/hubspot/client`, `lib/maps/geocode`, `lib/activity/log`, `lib/auth/session` |
| `lib/crm/account-read.ts` | Query helpers for account details | `getCRMAccountDetail`, `CRMAccountDetail` type | `drizzle-orm`, `db` |
| `components/crm/AccountDetailsCard.tsx` | Display account info with website link | Export default component | `lucide-react`, `@/lib/utils` |
| `components/crm/AccountEditForm.tsx` | Form for editing account details including website | Export default component | Server actions, form validation |
| `db/schema/customers.ts` | Drizzle ORM schema for customer accounts | `customerAccounts`, `CustomerAccount`, `NewCustomerAccount` types | `drizzle-orm/pg-core` |

## Data Models

### CustomerAccount Schema
```typescript
{
  id: UUID (primary key)
  userId: UUID (customer user reference)
  companyName: text (required)
  contactName: text
  address, city, state, county, zip: text
  phone, email: text
  businessType, businessEmail, businessPhone: text

  // Extended profile
  pocName, pocPhone, pocEmail: text
  hoursOfOperation: text
  preferredDeliveryDays, preferredDeliveryTimes: text
  additionalLocations: text (JSON)
  website: text (NEW - added in migration 0039)

  // License
  dcAbraNumber, liquorLicenseNumber: text
  liquorLicenseState, liquorLicenseExpiration, liquorLicenseUrl: text

  // HubSpot sync
  hubspotContactId, hubspotCompanyId: text
  dealStage: text (default: 'new_lead')
  starred: boolean

  // Financial
  creditLimit, balance: numeric(12,2)
  paymentTerms: text (default: 'NET30')

  // Sales assignment
  assignedSalesRepId: UUID
  assignedRegionId: UUID
  accountPriority: 'high'|'medium'|'low'
  accountType: 'on_premise'|'off_premise'|'chain'|'independent'

  // Visit tracking
  visitFrequency: integer (days, default: 30)
  lastVisitDate, nextRequiredVisitDate: timestamp

  // Geocoding
  lat, lng: double precision

  createdAt: timestamp
}
```

### Indexes (Migration 0040)
- `customer_accounts_user_id_idx` on `user_id`
- `customer_accounts_hubspot_company_id_idx` on `hubspot_company_id`
- `customer_accounts_assigned_sales_rep_id_idx` on `assigned_sales_rep_id`
- `customer_accounts_assigned_region_id_idx` on `assigned_region_id`

## Data Flow

### Account Creation Flow
1. User submits form via `AccountEditForm.tsx`
2. `createCustomerAccount()` server action called
3. Website URL validated via `validateWebsiteUrl()`
4. Account inserted with `.returning()` to get ID (no extra SELECT)
5. HubSpot contact upserted with account data
6. Activity event logged
7. Cache revalidated for CRM pages

### Account Update Flow
1. Form submission triggers `updateCustomerAccount()`
2. Changed fields tracked by comparing old vs new values
3. Database updated with `.returning()` (no extra SELECT)
4. HubSpot company and contact synced with updated data
5. Activity event logged with changed field names
6. Multiple CRM paths revalidated

### HubSpot Import Flow
1. Admin selects company from HubSpot via `importHubSpotCompany()`
2. Check for existing local account to prevent duplicates
3. Create local account record with company data + safe website URL
4. Call `syncHubSpotCompanyContactsToLocalAccount()`:
   - Fetch HubSpot contacts for company
   - Pre-fetch existing local contacts (indexed by email + hubspotContactId)
   - Batch insert new contacts
   - Promise.all() bulk update existing contacts
   - Returns import/update counts
5. Cache revalidated

### Contact Sync (HubSpot → Local)
1. `syncHubSpotCompanyContactsToLocalAccount()` called with companyId
2. Fetch contacts from HubSpot API (cached with `cache: 'no-store'`)
3. De-duplicate by email, then hubspotContactId
4. Split into inserts and updates
5. Batch insert new contacts (respecting primary contact logic)
6. Promise.all() update existing contacts in parallel
7. Return counts of imported and updated

### Website URL Validation
```typescript
validateWebsiteUrl(value: string | null): string | null
// Throws error if:
//  - URL is invalid (not parseable)
//  - Protocol is not http: or https:
// Returns null if input is null/falsy
```
- Used in: `createCustomerAccount`, `updateCustomerAccount`, `importHubSpotCompany`, `updateHubSpotCompanyAction`
- UI displays: `AccountDetailsCard.tsx` normalizes URL with protocol prefix if missing
- Link is clickable and opens in new tab

## Key Changes (April 2026)

### Migration 0039
- Added `website: text` column to `customer_accounts` table

### Migration 0040
- Created 4 indexes on frequently-filtered columns for performance:
  - `user_id` (customer lookup)
  - `hubspot_company_id` (HubSpot sync)
  - `assigned_sales_rep_id` (sales routing)
  - `assigned_region_id` (regional filtering)

### lib/crm/account-read.ts
- Simplified `getCRMAccountDetail()` to single direct query
- Removed dynamic column-detection fallback (`getCustomerAccountColumns`, `DEFAULT_ACCOUNT_DETAIL`)
- Now returns full `CRMAccountDetail` type with all account fields

### actions/crm.ts
- **New:** `validateWebsiteUrl()` helper validates http/https URLs
- **New:** Website field added to all create/update/import operations
- **Optimized:** Removed N+1 contact sync loop; now batch pre-fetches, bulk inserts, Promise.all updates
- **Optimized:** Fixed `isPrimary` logic using `hasPrimaryContact` guard (prevents multiple primary contacts)
- **Optimized:** Used `.returning()` in `importHubSpotCompany` and `updateCustomerAccount` to eliminate redundant SELECTs
- **Optimized:** Narrowed SELECT * to projected columns in `syncToHubSpot` and `deleteContact`
- **Fixed:** Removed duplicate `revalidatePath` call

### lib/hubspot/client.ts
- `getHubSpotCompanyContacts()` now uses `cache: 'no-store'` instead of `revalidate: 300`
- Ensures fresh contact data on every sync

### components/crm/AccountDetailsCard.tsx
- Added website section with clickable link (Globe icon)
- URL normalized with https:// protocol if not present

### components/crm/AccountEditForm.tsx
- Added website input field with validation feedback

## Related Areas
- **Database:** `db/schema/customers.ts`, `db/schema/contacts.ts`
- **HubSpot Integration:** `lib/hubspot/client.ts`
- **Activity Logging:** `lib/activity/log.ts`
- **Geocoding:** `lib/maps/geocode.ts`
- **UI Components:** `components/crm/*`
- **Auth:** `lib/auth/session.ts`
