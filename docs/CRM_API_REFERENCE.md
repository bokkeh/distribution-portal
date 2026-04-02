# CRM API Reference

**Last Updated:** 2026-04-02

## Overview

The CRM module provides server actions for managing customer accounts, contacts, and HubSpot integration. All functions are in `actions/crm.ts` and require admin or staff role.

## Account Operations

### createCustomerAccount()

Creates a new customer account in the portal.

**Signature:**
```typescript
export async function createCustomerAccount(
  _prev: { success?: boolean; accountId?: string; error?: string } | null,
  formData: FormData
): Promise<{ success?: boolean; accountId?: string; error?: string }>
```

**Parameters:**
- `formData` keys:
  - `companyName` (required): Company name
  - `phone`: Phone number
  - `email`: Email address
  - `address`: Street address
  - `city`: City
  - `state`: State (normalized via `normalizeAccountGeography`)
  - `county`: County (normalized)
  - `zip`: Postal code
  - `businessEmail`: Business email (different from contact email)
  - `businessPhone`: Business phone
  - `pocName`: Point of contact name
  - `pocPhone`: POC phone
  - `pocEmail`: POC email
  - `contactName`: Primary contact name
  - `hoursOfOperation`: Operating hours
  - `website`: Website URL (validated as http/https)
  - `dcAbraNumber`: DC ABRA license number
  - `creditLimit`: Credit limit (default: 0)
  - `paymentTerms`: Payment terms (default: NET30)

**Returns:**
```typescript
{
  success: true,
  accountId: string  // New account UUID
}
// OR
{
  error: string  // Error message (e.g., "Company name is required.")
}
```

**Behavior:**
1. Validates company name (required)
2. Validates website URL format (if provided)
3. Inserts account with `.returning()` to get ID
4. Upserts HubSpot contact with account data (email/name extracted)
5. Logs activity event: `account_created`
6. Revalidates `/admin/crm` and `/staff/crm`

**Example:**
```typescript
const formData = new FormData()
formData.append('companyName', 'Local Liquor Store')
formData.append('phone', '202-555-1234')
formData.append('website', 'https://localliquor.com')
formData.append('creditLimit', '5000')

const result = await createCustomerAccount(null, formData)
if (result.success) {
  console.log('Created account:', result.accountId)
}
```

---

### updateCustomerAccount()

Updates an existing customer account.

**Signature:**
```typescript
export async function updateCustomerAccount(
  _prev: { error?: string; success?: boolean; changedFields?: string[] } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean; changedFields?: string[] }>
```

**Parameters:**
- `formData` keys (same as createCustomerAccount, plus `id` and `mode`):
  - `id` (required): Account UUID
  - `mode`: 'admin' or 'staff' (for audit logging)
  - All other fields optional (only changed fields updated)
  - `website`: Validated as http/https

**Returns:**
```typescript
{
  success: true,
  changedFields: ['companyName', 'website', 'creditLimit']  // List of changed fields
}
// OR
{
  error: string
}
```

**Behavior:**
1. Validates account exists
2. Validates website URL format (if provided)
3. Compares old vs new values to track changes
4. Updates account with `.returning()` (no extra SELECT)
5. Syncs to HubSpot if company has HubSpot ID
6. Upserts HubSpot contact with updated data
7. Logs activity event: `account_updated` (includes changed field names)
8. Revalidates affected CRM pages

**Example:**
```typescript
const formData = new FormData()
formData.append('id', 'account-uuid')
formData.append('companyName', 'Updated Store Name')
formData.append('website', 'https://newsite.com')

const result = await updateCustomerAccount(null, formData)
if (result.success) {
  console.log('Changed:', result.changedFields.join(', '))
}
```

---

### mergeCustomerAccounts()

Merges a source account into a target account. All related orders, invoices, tastings, etc. are re-assigned to the target.

**Signature:**
```typescript
export async function mergeCustomerAccounts(formData: FormData): Promise<void>
```

**Parameters:**
- `formData` keys:
  - `sourceAccountId` (required): Account to merge from
  - `targetAccountId` (required): Account to merge into

**Behavior:**
1. Validates both accounts exist and are different
2. Re-assigns all related records:
   - `contacts` → targetAccountId
   - `orders`, `invoices`, `tastings`, `deliveryStops`, `salesRouteStops`, `smsThreads` → targetAccountId
   - `activityEvents` → targetAccountId
3. Merges field values (target takes precedence, source fills nulls)
4. Handles special fields like `hoursOfOperation`, `website` with text combination
5. Merges account preferences if source has them and target doesn't
6. Logs activity event: `account_merged`
7. Deletes source account
8. Revalidates CRM pages

---

## Contact Operations

### addContact()

Adds a new contact to a customer account.

**Signature:**
```typescript
export async function addContact(formData: FormData): Promise<void>
```

**Parameters:**
- `formData` keys:
  - `customerId` (required): Account UUID
  - `name` (required): Contact name
  - `email`: Email address
  - `phone`: Phone number
  - `phoneType`: 'mobile' | 'landline' | 'voip' | 'other'
  - `preferredContact`: 'email' | 'sms' | 'call'
  - `title`: Job title
  - `isPrimary`: Boolean (checkbox)

**Behavior:**
1. Inserts contact record
2. Logs activity event: `contact_added`
3. Revalidates contact paths

---

### updateContact()

Updates an existing contact.

**Signature:**
```typescript
export async function updateContact(contactId: string, formData: FormData): Promise<{ success?: true; error?: string }>
```

**Parameters:**
- `contactId`: Contact UUID
- `formData` keys: Same as `addContact()`

**Returns:**
```typescript
{ success: true }
// OR
{ error: 'Contact not found' }
```

**Behavior:**
1. Fetches existing contact
2. Tracks changed fields
3. Updates contact
4. Logs activity event: `contact_updated` (includes changed field names)
5. Revalidates contact paths

---

### deleteContact()

Removes a contact from an account.

**Signature:**
```typescript
export async function deleteContact(contactId: string): Promise<{ success?: true; error?: string }>
```

**Returns:**
```typescript
{ success: true }
// OR
{ error: 'Contact not found' }
```

**Behavior:**
1. Fetches contact with limited columns (id, customerId, name, email, phone)
2. Deletes contact
3. Logs activity event: `contact_deleted` (includes contact name and phone)
4. Revalidates contact paths

---

### mergeContacts()

Merges a source contact into a target contact within the same account.

**Signature:**
```typescript
export async function mergeContacts(formData: FormData): Promise<void>
```

**Parameters:**
- `formData` keys:
  - `sourceContactId`: Contact to merge from
  - `targetContactId`: Contact to merge into

**Behavior:**
1. Merges all fields (target takes precedence)
2. Logs activity event: `contact_merged`
3. Deletes source contact

---

## HubSpot Integration

### importHubSpotCompany()

Imports a company from HubSpot as a new customer account.

**Signature:**
```typescript
export async function importHubSpotCompany(hubspotCompanyId: string): Promise<{ success?: true; error?: string }>
```

**Returns:**
```typescript
{ success: true }
// OR
{ error: 'Already imported' | 'Company not found' }
```

**Behavior:**
1. Checks if company already imported (prevents duplicates)
2. Fetches company from HubSpot by ID
3. Validates website URL (safe fallback to null if invalid)
4. Creates local account with:
   - Basic info: companyName, address, city, state, zip, phone, website
   - Refs: hubspotCompanyId
   - Defaults: creditLimit='0', balance='0', paymentTerms='NET30'
5. Syncs HubSpot contacts via `syncHubSpotCompanyContactsToLocalAccount()`:
   - Fetches contacts with `cache: 'no-store'` for fresh data
   - Pre-fetches existing local contacts (indexed by email + hubspotContactId)
   - Batch inserts new contacts (respects primary contact logic)
   - Promise.all() bulk updates existing contacts
6. Returns account inserted with `.returning()`
7. Revalidates CRM pages

---

### updateHubSpotCompanyAction()

Updates a HubSpot company and optionally syncs back to local account.

**Signature:**
```typescript
export async function updateHubSpotCompanyAction(
  hubspotId: string,
  localAccountId: string | null,
  data: {
    name: string
    phone: string
    address: string
    city: string
    state: string
    zip: string
    website: string
    industry: string
  }
): Promise<{ success: true } | { error: string }>
```

**Returns:**
```typescript
{ success: true }
// OR
{ error: string }  // e.g., "Website must use http or https."
```

**Behavior:**
1. Validates website URL (throws error if invalid)
2. Updates HubSpot company via API
3. If `localAccountId` provided:
   - Updates local account fields: companyName, phone, address, city, state, zip, website
4. Revalidates `/admin/crm`

---

### syncToHubSpot()

Syncs a local account and its contacts to HubSpot.

**Signature:**
```typescript
export async function syncToHubSpot(accountId: string): Promise<void>
```

**Behavior:**
1. Fetches account with projected columns (hubspotCompanyId, email, phone, companyName, etc.)
2. Fetches all contacts for account
3. Selects primary contact (or first contact if no primary)
4. Upserts HubSpot contact with account data:
   - Name extracted from primary contact or account
   - Email, phone, company, location from account
   - Credit limit and payment terms from account
5. Updates local account with returned `hubspotContactId`
6. If account has HubSpot company ID:
   - Calls `syncHubSpotCompanyContactsToLocalAccount()` to pull contact updates
7. Revalidates CRM pages

---

### syncHubSpotCompanyContactsToLocalAccount()

Internal helper that syncs HubSpot company contacts to local database.

**Signature:**
```typescript
async function syncHubSpotCompanyContactsToLocalAccount(
  accountId: string,
  hubspotCompanyId: string
): Promise<{ imported: number; updated: number }>
```

**Performance Optimizations (April 2026):**
- Fetch HubSpot contacts with `cache: 'no-store'` (always fresh)
- Single pre-fetch of all existing contacts (indexed by email + hubspotContactId)
- Batch insert new contacts in single query
- Promise.all() parallelizes bulk updates
- Returns counts for audit logging

**Primary Contact Logic:**
- Uses `hasPrimaryContact` guard to prevent duplicate primary contacts
- Sets first new contact as primary if none exist
- Preserves primary status on existing contacts

---

## Field Validation

### validateWebsiteUrl()

Validates and normalizes website URLs.

**Signature:**
```typescript
function validateWebsiteUrl(value: string | null): string | null
```

**Logic:**
```typescript
// Returns null if input is null/falsy
// Throws Error if:
//   - URL is not parseable (not valid URL syntax)
//   - Protocol is not http: or https:
// Otherwise returns the validated URL as-is
```

**Usage:**
- Used in: `createCustomerAccount()`, `updateCustomerAccount()`, `importHubSpotCompany()`, `updateHubSpotCompanyAction()`
- In forms, use try/catch to provide feedback:
  ```typescript
  try {
    const validated = validateWebsiteUrl(inputValue)
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Invalid website')
  }
  ```

---

## UI Components

### AccountDetailsCard

Displays read-only account information in a card layout.

**Props:**
```typescript
{
  account: {
    id: string
    companyName: string
    address: string | null
    city: string | null
    state: string | null
    zip: string | null
    phone: string | null
    pocName?: string | null
    pocEmail?: string | null
    hoursOfOperation?: string | null
    website?: string | null
    creditLimit: string | null
    notificationPreference?: string | null
  }
  mode: 'admin' | 'staff'
}
```

**Features:**
- Clickable address links to Google Maps directions
- Website link with protocol normalization (adds https:// if missing)
- Credit limit formatted as currency
- Notification preference badges (SMS/Email/Both)

---

### AccountEditForm

Form for creating or editing customer accounts.

**Props:**
```typescript
{
  account?: {
    id: string
    // ... all CRMAccountDetail fields
  }
  mode: 'admin' | 'staff' | 'customer'
  isLoading?: boolean
}
```

**Features:**
- Website input field with validation
- All standard address/contact fields
- Credit limit and payment terms
- POC (point of contact) section
- Success/error state feedback

---

## Data Types

### CRMAccountDetail

Complete account data structure returned by `getCRMAccountDetail()`.

```typescript
type CRMAccountDetail = {
  id: string
  userId: string | null
  companyName: string
  contactName: string | null
  address: string | null
  city: string | null
  state: string | null
  county: string | null
  zip: string | null
  phone: string | null
  email: string | null
  businessType: string | null
  dcAbraNumber: string | null
  liquorLicenseNumber: string | null
  liquorLicenseState: string | null
  liquorLicenseExpiration: string | null
  liquorLicenseUrl: string | null
  hubspotContactId: string | null
  hubspotCompanyId: string | null
  dealStage: string | null
  starred: boolean
  businessEmail: string | null
  businessPhone: string | null
  notificationPreference: string | null
  notificationPhone: string | null
  pocName: string | null
  pocPhone: string | null
  pocEmail: string | null
  hoursOfOperation: string | null
  preferredDeliveryDays: string | null
  preferredDeliveryTimes: string | null
  additionalLocations: string | null
  website: string | null  // NEW - April 2026
  creditLimit: string
  balance: string
  paymentTerms: string | null
  assignedRegionId: string | null
  lat: number | null
  lng: number | null
  createdAt: Date
}
```

---

## Error Handling

All server actions follow a consistent error pattern:

```typescript
try {
  // Operation
  return { success: true, ...data }
} catch (error) {
  return {
    error: error instanceof Error ? error.message : 'Operation failed'
  }
}
```

Common errors:
- "Company name is required." — createCustomerAccount
- "Account not found." — updateCustomerAccount
- "Contact not found." — updateContact, deleteContact
- "Website must be a valid http or https URL." — validateWebsiteUrl
- "Both source and target accounts are required." — mergeCustomerAccounts
- "Already imported" — importHubSpotCompany
- "You are not assigned to this account." — updateAccountBySalesRep (sales rep only)

---

## Activity Event Logging

All mutations are logged to `activity_events` table:

```typescript
{
  entityType: 'account',
  entityId: accountId,
  actorUserId: session.user.id,
  kind: 'account_created' | 'account_updated' | 'account_merged' | 'contact_added' | etc,
  title: 'Human readable title',
  body: 'Detailed description with changed field names',
  metadata: {
    // Varies by operation
    // E.g., changedFields, before/after values, merged IDs, etc.
  },
  createdAt: Date  // Auto-set
}
```

---

## Performance Notes

### Query Optimization
- All account/contact queries use projected column selection (no SELECT *)
- `getCRMAccountDetail()` single direct query (no fallback logic)
- HubSpot contact sync uses single pre-fetch + batch operations

### Database Indexes (Migration 0040)
- `customer_accounts_user_id_idx` — Customer lookup
- `customer_accounts_hubspot_company_id_idx` — HubSpot sync
- `customer_accounts_assigned_sales_rep_id_idx` — Sales routing
- `customer_accounts_assigned_region_id_idx` — Regional filtering

### Caching Strategy
- HubSpot contact fetch: `cache: 'no-store'` (always fresh)
- Account pages revalidated on mutation
- `.returning()` used to eliminate redundant SELECTs

---

## Authorization

All CRM functions require:
- `requireAdminOrStaff()` — Most operations
- `requireRole('sales_rep', 'sales_manager', 'admin')` — `updateAccountBySalesRep()`
- `requireRole('sales_rep', 'sales_manager', 'admin')` — `geocodeAccount()`

Enforced at middleware level and runtime.
