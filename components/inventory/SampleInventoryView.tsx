import Link from 'next/link'
import Image from 'next/image'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  inventoryLocationBalances, inventoryLocations, inventoryLocationThresholds, inventoryLowStockAlerts,
  monthlyInventoryReports, products, quickBooksExports, replenishmentRequests,
  QUICKBOOKS_SAMPLE_CATEGORIES, sampleRequests, users,
} from '@/db/schema'
import { assignSampleLocationOwner, fulfillReplenishment, markQuickBooksExported, saveLocationThreshold, setLocationBalance } from '@/actions/sample-inventory'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, ArrowRightLeft, Download, Package, Plus, ReceiptText, Warehouse } from 'lucide-react'
import { toDisplayAvatarUrl } from '@/lib/users/avatar'

const input = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'
const formAction = (action: (formData: FormData) => Promise<unknown>) => action as (formData: FormData) => Promise<void>

export async function SampleInventoryView({ basePath = '/admin/sample-inventory' }: { basePath?: string }) {
  const [locations, productRows, balances, thresholds, requests, replenishments, exports, alerts, reports, locationOwners] = await Promise.all([
    db.select().from(inventoryLocations).where(eq(inventoryLocations.active, true)).orderBy(asc(inventoryLocations.name)),
    db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.name)),
    db.select().from(inventoryLocationBalances),
    db.select().from(inventoryLocationThresholds),
    db.select().from(sampleRequests).orderBy(desc(sampleRequests.createdAt)).limit(20),
    db.select().from(replenishmentRequests).where(inArray(replenishmentRequests.status, ['requested', 'approved', 'partially_fulfilled'])).orderBy(asc(replenishmentRequests.createdAt)),
    db.select().from(quickBooksExports).where(inArray(quickBooksExports.status, ['pending_mapping', 'pending_approval', 'ready', 'failed'])).orderBy(desc(quickBooksExports.createdAt)).limit(20),
    db.select().from(inventoryLowStockAlerts).where(inArray(inventoryLowStockAlerts.status, ['open', 'acknowledged'])).orderBy(desc(inventoryLowStockAlerts.createdAt)),
    db.select().from(monthlyInventoryReports).orderBy(desc(monthlyInventoryReports.reportMonth)).limit(12),
    db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
  ])
  const locationMap = new Map(locations.map((row) => [row.id, row]))
  const productMap = new Map(productRows.map((row) => [row.id, row]))
  const balanceMap = new Map(balances.map((row) => [`${row.locationId}:${row.productId}`, row]))
  const thresholdMap = new Map(thresholds.map((row) => [`${row.locationId}:${row.productId}`, row]))
  const ownerMap = new Map(locationOwners.map((owner) => [owner.id, owner]))
  const ownerFirstNameMap = new Map(locationOwners.map((owner) => [owner.name.trim().split(/\s+/)[0].toLowerCase(), owner]))
  const openReplenishmentCount = replenishments.length
  const qbAttention = exports.length

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold text-slate-900">Sample Inventory</h2><p className="text-sm text-slate-500">Location stock, sample usage, replenishment, and accounting categorization.</p></div>
      <Button asChild><Link href={`${basePath}/new`}><Plus className="h-4 w-4" />New sample request</Link></Button>
    </div>

    <div className="grid gap-4 md:grid-cols-4">
      <Metric icon={<Warehouse />} label="Locations" value={locations.length} />
      <Metric icon={<ArrowRightLeft />} label="Open replenishments" value={openReplenishmentCount} />
      <Metric icon={<AlertTriangle />} label="Low-stock alerts" value={alerts.length} />
      <Metric icon={<ReceiptText />} label="QB items needing attention" value={qbAttention} />
    </div>

    <Card><CardHeader><CardTitle>Location inventory</CardTitle></CardHeader><CardContent className="space-y-6">
      {locations.map((location) => { const locationLabel = location.name.split(' - ')[0].trim(); const owner = location.ownerUserId ? ownerMap.get(location.ownerUserId) : ownerFirstNameMap.get(locationLabel.toLowerCase()); const avatarUrl = toDisplayAvatarUrl(owner?.avatarUrl); const initials = (owner?.name ?? locationLabel).split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(); return <section key={location.id} className="rounded-xl border border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 font-mono text-xs font-bold text-slate-600">{avatarUrl ? <Image src={avatarUrl} alt={owner?.name ?? location.name} fill sizes="44px" className="object-cover" unoptimized /> : location.type === 'warehouse' ? <Warehouse className="h-5 w-5 text-slate-500" aria-hidden="true" /> : initials}</div><div className="min-w-0"><h2 className="truncate font-semibold">{location.name}</h2><p className="text-xs text-slate-500">{location.type === 'warehouse' ? 'Main warehouse' : owner ? `Managed by ${owner.name}` : 'Owner not linked'}{location.region ? ` · ${location.region}` : ''}</p></div></div><div className="flex flex-wrap items-center justify-end gap-2">{location.type === 'sample' && <form action={formAction(assignSampleLocationOwner)} className="flex items-center gap-2"><label className="sr-only" htmlFor={`owner-${location.id}`}>Inventory owner</label><select id={`owner-${location.id}`} className={`${input} min-w-48`} name="ownerUserId" defaultValue={location.ownerUserId ?? ''} required><option value="" disabled>Select inventory owner</option>{locationOwners.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select><input type="hidden" name="locationId" value={location.id}/><Button size="sm" variant="outline">Save owner</Button></form>}<Badge variant="outline">{location.type}</Badge></div></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="py-2">SKU / Product</th><th>On hand</th><th>Minimum</th><th>Set audited balance &amp; category</th></tr></thead><tbody>
          {productRows.map((product) => { const key = `${location.id}:${product.id}`; const balance = balanceMap.get(key); const threshold = thresholdMap.get(key); return <tr key={product.id} className="border-b border-slate-100 align-top"><td className="py-3 pr-4"><strong>{product.sku}</strong><br/><span className="text-slate-500">{product.name}</span></td><td className="whitespace-nowrap py-3 pr-4">{balance?.quantityCases ?? 0} cases<br/>{balance?.quantityBottles ?? 0} bottles</td><td className="py-3 pr-4"><form action={formAction(saveLocationThreshold)} className="flex flex-wrap gap-2"><input type="hidden" name="locationId" value={location.id}/><input type="hidden" name="productId" value={product.id}/><input className={`${input} w-20`} name="minimumCases" type="number" min="0" defaultValue={threshold?.minimumCases ?? 0} aria-label="Minimum cases"/><input className={`${input} w-20`} name="minimumBottles" type="number" min="0" defaultValue={threshold?.minimumBottles ?? 0} aria-label="Minimum bottles"/><Button size="sm" variant="outline">Save</Button></form></td><td className="py-3"><form action={formAction(setLocationBalance)} className="flex flex-wrap gap-2"><input type="hidden" name="locationId" value={location.id}/><input type="hidden" name="productId" value={product.id}/><input className={`${input} w-20`} name="quantityCases" type="number" min="0" defaultValue={balance?.quantityCases ?? 0} aria-label="Cases on hand"/><input className={`${input} w-20`} name="quantityBottles" type="number" min="0" defaultValue={balance?.quantityBottles ?? 0} aria-label="Bottles on hand"/><select className={`${input} min-w-44`} name="quickBooksCategory" required defaultValue="" aria-label="Adjustment category"><option value="" disabled>Choose category</option>{QUICKBOOKS_SAMPLE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select><input className={`${input} min-w-44`} name="reason" required placeholder="Reason for adjustment"/><Button size="sm">Update</Button></form></td></tr> })}
        </tbody></table></div>
      </section>})}
    </CardContent></Card>

    <div className="grid gap-6 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>Recent sample requests</CardTitle></CardHeader><CardContent className="space-y-3">{requests.length ? requests.map((request) => <div key={request.id} className="flex items-start justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{request.requestNumber} · {request.recipientName}</p><p className="text-sm text-slate-500">{locationMap.get(request.sourceLocationId)?.name} · {request.quickBooksCategory}</p><p className="text-xs text-slate-400">{request.purpose}</p></div><Badge>{request.status.replaceAll('_', ' ')}</Badge></div>) : <Empty text="No sample requests yet."/>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Open replenishments</CardTitle></CardHeader><CardContent className="space-y-3">{replenishments.length ? replenishments.map((item) => <div key={item.id} className="rounded-lg border p-3"><p className="font-medium">{productMap.get(item.productId)?.name}</p><p className="text-sm text-slate-500">{locationMap.get(item.sourceLocationId)?.name} → {locationMap.get(item.destinationLocationId)?.name}</p><p className="mb-3 text-sm">Remaining: {item.requestedCases - item.fulfilledCases} cases / {item.requestedBottles - item.fulfilledBottles} bottles</p><form action={formAction(fulfillReplenishment)} className="flex flex-wrap gap-2"><input type="hidden" name="replenishmentId" value={item.id}/><input className={`${input} w-24`} name="quantityCases" type="number" min="0" max={item.requestedCases - item.fulfilledCases} defaultValue={item.requestedCases - item.fulfilledCases} aria-label="Cases to fulfill"/><input className={`${input} w-24`} name="quantityBottles" type="number" min="0" max={item.requestedBottles - item.fulfilledBottles} defaultValue={item.requestedBottles - item.fulfilledBottles} aria-label="Bottles to fulfill"/><Button size="sm">Record transfer</Button></form></div>) : <Empty text="No open replenishments."/>}</CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>QuickBooks export queue</CardTitle></CardHeader><CardContent className="space-y-3">{exports.length ? exports.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">Sample request {item.sampleRequestId.slice(0, 8)}</p><Badge variant="outline">{item.status.replaceAll('_', ' ')}</Badge>{item.lastError && <p className="text-sm text-red-600">{item.lastError}</p>}</div><form action={formAction(markQuickBooksExported)} className="flex gap-2"><input type="hidden" name="exportId" value={item.id}/><input className={input} name="externalTransactionId" required placeholder="QuickBooks transaction ID"/><Button size="sm">Mark exported</Button></form></div>) : <Empty text="Nothing is waiting for export."/>}</CardContent></Card>

    <Card><CardHeader><CardTitle>Monthly reports</CardTitle></CardHeader><CardContent className="space-y-2">{reports.length ? reports.map((report) => <div key={report.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{report.reportMonth}</p><p className="text-xs text-slate-500">{report.status.replaceAll('_', ' ')} · {report.sentRecipientEmails.length}/{report.recipientEmails.length} recipients</p></div>{report.csvContent && <Button asChild size="sm" variant="outline"><Link href={`/api/sample-inventory/reports/${report.id}/csv`}><Download className="h-4 w-4"/>CSV</Link></Button>} {report.csvContent && <Button asChild size="sm" variant="outline"><Link href={`/api/sample-inventory/reports/${report.id}/pdf`}><Download className="h-4 w-4"/>PDF</Link></Button>}</div>) : <Empty text="Reports appear after the first monthly run."/>}</CardContent></Card>
  </div>
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <Card><CardContent className="flex items-center gap-3 p-4"><span className="rounded-lg bg-blue-50 p-2 text-blue-600 [&>svg]:h-5 [&>svg]:w-5">{icon}</span><div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-slate-500">{label}</p></div></CardContent></Card> }
function Empty({ text }: { text: string }) { return <div className="py-8 text-center text-sm text-slate-500"><Package className="mx-auto mb-2 h-6 w-6"/>{text}</div> }
