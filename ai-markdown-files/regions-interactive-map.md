# Interactive Regions Map — Implementation Plan

## Goal

Add an interactive Google Map to the admin regions page (`/admin/sales/regions`) that lets admins:
- See all customer accounts plotted as markers, color-coded by region
- Hover a region in the sidebar to highlight its markers and see a stats card (rep, revenue, tastings, deliveries)
- Click an individual account marker to see store-level detail in an InfoWindow
- Draw a visual boundary (convex hull polygon) around each region's accounts

---

## What Already Exists (Do Not Recreate)

| Asset | Path |
|---|---|
| Google Maps library | `@react-google-maps/api` v2.20.8 already in `package.json` |
| Maps API key | `NEXT_PUBLIC_GOOGLE_MAPS_KEY` env var already configured |
| Reference map component | `components/deliveries/DeliveryMap.tsx` |
| Another reference | `components/sales-routes/SalesRouteMapInner.tsx` |
| Server-side geocoding | `lib/maps/geocode.ts` — `geocodeAddress(address)` |
| Regions schema | `db/schema/salesRegions.ts` — `salesRegions` table |
| Accounts schema | `db/schema/customers.ts` — `customerAccounts` table (has address, city, state, zip; no lat/lng yet) |
| Regions actions | `actions/sales-members.ts` — `getSalesRegions`, `getRegionAccountStats`, etc. |
| Regions page | `app/(admin)/admin/sales/regions/page.tsx` |
| Regions list component | `app/(admin)/admin/sales/regions/RegionList.tsx` |

---

## Step 1 — Add Lat/Lng to customerAccounts Schema

**File:** `db/schema/customers.ts`

Add two nullable float columns to the `customerAccounts` table:

```ts
lat: real('lat'),
lng: real('lng'),
```

Run `npm run db:push` to apply.

---

## Step 2 — Create `getRegionMapData` Server Action

**File:** `actions/regions-map.ts` (new file)

This action is the single data source for the map. It should return:

```ts
type RegionMapData = {
  regions: {
    id: string
    name: string
    description: string | null
    assignedRep: { id: string; name: string; email: string } | null
    stats: {
      accountCount: number
      totalRevenue: number      // sum of paid invoice amounts
      tastingCount: number      // count of tastings for accounts in this region
      deliveryCount: number     // count of deliveries for accounts in this region
    }
  }[]
  accounts: {
    id: string
    companyName: string
    address: string | null
    city: string | null
    state: string | null
    zip: string | null
    lat: number | null
    lng: number | null
    regionId: string | null
    accountType: string | null
    accountPriority: string | null
    lastVisitDate: Date | null
    nextRequiredVisitDate: Date | null
    // Per-account stats
    revenue: number
    tastingCount: number
    deliveryCount: number
  }[]
}
```

**Joins needed:**
- `customerAccounts` → `salesRegions` (via `assignedRegionId`)
- `salesRegions` → `salesMembers` (via `assignedManagerId`) → `users` (via `userId`) for rep name/email
- `customerAccounts` → `invoices` (sum of `amountPaid` where status = `paid`) for revenue
- `customerAccounts` → `tastings` (count where `accountId` matches) for tasting count
- `customerAccounts` → `deliveries` / `deliveryStops` (count) for delivery count

Keep this a `requireAdmin()` protected server action.

---

## Step 3 — Create `geocodeAccountsBatch` Server Action

**File:** `actions/regions-map.ts` (same file, second export)

```ts
export async function geocodeAccountsBatch(): Promise<{ geocoded: number; failed: number }>
```

- Queries all accounts where `lat IS NULL` and address fields are present
- Calls `geocodeAddress` from `lib/maps/geocode.ts` for each (respect rate limits — add 50ms delay between calls or batch in groups of 10)
- Saves `lat`, `lng` back to the account row via `db.update`
- Returns counts for UI feedback
- Protected with `requireAdmin()`

---

## Step 4 — Convex Hull Utility

**File:** `lib/maps/convex-hull.ts` (new file)

Pure TypeScript function — no external dependency needed.

```ts
export function convexHull(points: { lat: number; lng: number }[]): { lat: number; lng: number }[]
```

Implement Graham scan or gift-wrapping algorithm. Used to draw the region polygon on the map. If a region has fewer than 3 points return the points as-is (line or single marker — no polygon drawn).

---

## Step 5 — Region Color Palette

**File:** `lib/maps/region-colors.ts` (new file)

Define a fixed set of 10–12 distinct colors for regions, cycling if there are more regions than colors:

```ts
export const REGION_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#F97316', // orange
  '#EC4899', // pink
  '#14B8A6', // teal
  '#A855F7', // purple
]

export function getRegionColor(index: number): string {
  return REGION_COLORS[index % REGION_COLORS.length]
}
```

---

## Step 6 — Build the Map Component

### 6a. Wrapper (server-side safe)

**File:** `components/regions/RegionsMapWrapper.tsx`

- A simple `'use client'` wrapper that dynamic-imports `RegionsMap` with `ssr: false`
- Accepts the `RegionMapData` as a prop (passed down from the server page)

### 6b. Main map component

**File:** `components/regions/RegionsMap.tsx`

```
'use client'
```

**Props:**
```ts
interface Props {
  data: RegionMapData
}
```

**State:**
```ts
const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null)
const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
```

**Layout:** Two-column flex — left sidebar (region list) + right Google Map

---

#### Left Sidebar

- Header: "Regions" + account total count
- One card per region showing:
  - Colored dot (matching marker color)
  - Region name
  - Rep name (or "Unassigned")
  - Account count badge
- `onMouseEnter` → sets `hoveredRegionId`
- `onMouseLeave` → clears `hoveredRegionId`
- When a region is hovered, show a stats mini-card below the region row:
  - Revenue: `$X,XXX`
  - Tastings: `N`
  - Deliveries: `N`

Also add an "Unassigned" entry at the bottom for accounts with no region.

---

#### Google Map

Use `<GoogleMap>` from `@react-google-maps/api`:

- Center on DC area (default `{ lat: 38.9, lng: -77.0 }`) or compute center from all account coordinates
- Default zoom: 10

**Markers** — one per account with a lat/lng:
- `icon`: colored circle SVG using the region's color. If `hoveredRegionId` is set and this account's region does not match, set the marker `opacity` to 0.3
- `onClick` → sets `selectedAccountId`
- Use `MarkerF` (functional API) or `AdvancedMarkerElement` if available

**Polygons** — one per region:
- Compute convex hull from the region's account coordinates
- `fillColor` and `strokeColor` = region color
- `fillOpacity`: 0.08 normally, 0.2 when hovered
- `strokeOpacity`: 0.4 normally, 0.9 when hovered
- `strokeWeight`: 2

**InfoWindow** — shown when `selectedAccountId` is set:
- Position: the selected account's `{ lat, lng }`
- Content:
  - Company name (bold)
  - Address
  - Type + Priority badges
  - Revenue: `$X,XXX`
  - Tastings: `N` | Deliveries: `N`
  - Last visit date
  - Next required visit date (red if overdue)
  - Link: `View Account →` → `/admin/crm/[accountId]` or `/sales/accounts/[accountId]`
- Close button clears `selectedAccountId`

---

## Step 7 — Geocode Accounts Button

**File:** `components/regions/GeocodeButton.tsx`

A small `'use client'` button in the map panel:
- Shows "Geocode missing addresses (N accounts)" where N = count of accounts without lat/lng
- On click calls `geocodeAccountsBatch()` and shows a loading spinner + result toast
- Only visible if N > 0
- After completion, refresh the page (`router.refresh()`)

---

## Step 8 — Wire Into the Regions Page

**File:** `app/(admin)/admin/sales/regions/page.tsx`

Add a tab toggle at the top of the page: **List View** | **Map View**

- List view: existing `<RegionList />` component (unchanged)
- Map view: call `getRegionMapData()` and pass result to `<RegionsMapWrapper data={mapData} />`

Load map data lazily — only call `getRegionMapData()` when the map tab is active (use a `Suspense` boundary with a skeleton).

```tsx
// Rough structure
<Tabs defaultValue="list">
  <TabsList>
    <TabsTrigger value="list">List View</TabsTrigger>
    <TabsTrigger value="map">Map View</TabsTrigger>
  </TabsList>
  <TabsContent value="list">
    <RegionList ... />
  </TabsContent>
  <TabsContent value="map">
    <Suspense fallback={<MapSkeleton />}>
      <MapDataLoader />  {/* async server component that calls getRegionMapData */}
    </Suspense>
  </TabsContent>
</Tabs>
```

---

## File Checklist

| # | File | Action |
|---|---|---|
| 1 | `db/schema/customers.ts` | Add `lat: real('lat'), lng: real('lng')` |
| 2 | `actions/regions-map.ts` | New — `getRegionMapData`, `geocodeAccountsBatch` |
| 3 | `lib/maps/convex-hull.ts` | New — convex hull algorithm |
| 4 | `lib/maps/region-colors.ts` | New — color palette + `getRegionColor` |
| 5 | `components/regions/RegionsMap.tsx` | New — main interactive map client component |
| 6 | `components/regions/RegionsMapWrapper.tsx` | New — dynamic import wrapper (ssr: false) |
| 7 | `components/regions/GeocodeButton.tsx` | New — geocode trigger button |
| 8 | `app/(admin)/admin/sales/regions/page.tsx` | Add Tabs + lazy map data loader |

---

## Key Constraints

- **Do not break the existing `RegionList.tsx`** — the list view must remain fully functional
- **Respect the existing Google Maps pattern** — follow `DeliveryMap.tsx` for `useJsApiLoader` setup and marker/polygon API usage
- **Geocoding is async and slow** — never block page load on geocoding; show markers only for accounts that already have lat/lng cached
- **No new npm packages** — `@react-google-maps/api` and all required UI primitives already exist
- **requireAdmin()** on all new server actions
- Accounts with no lat/lng (not yet geocoded) should be listed below the map in a simple table, not silently dropped
