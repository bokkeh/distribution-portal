import Link from 'next/link'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  inventoryLocationBalances, inventoryLocations, inventoryLocationThresholds, inventoryLowStockAlerts,
  monthlyInventoryReports, products, quickBooksCategoryMappings, quickBooksExports, replenishmentRequests,
  sampleRequests,
} from '@/db/schema'
import { fulfillReplenishment, markQuickBooksExported, saveLocationThreshold, saveQuickBooksMapping, setLocationBalance } from '@/actions/sample-inventory'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, ArrowRightLeft, Download, Package, Plus, ReceiptText, Warehouse } from 'lucide-react'

const input = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'
const formAction = (action: (formData: FormData) => Promise<unknown>) => action as (formData: FormData) => Promise<void>

export default async function SampleInventoryPage() {
  const [locations, productRows, balances, thresholds, requests, replenishments, mappings, exports, alerts, reports] = await Promise.all([
    db.select().from(inventoryLocations).where(eq(inventoryLocations.active, true)).orderBy(asc(inventoryLocations.name)),
    db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.name)),
    db.select().from(inventoryLocationBalances),
    db.select().from(inventoryLocationThresholds),
    db.select().from(sampleRequests).orderBy(desc(sampleRequests.createdAt)).limit(20),
    db.select().from(replenishmentRequests).where(inArray(replenishmentRequests.status, ['requested', 'approved', 'partially_fulfilled'])).orderBy(asc(replenishmentRequests.createdAt)),
    db.select().from(quickBooksCategoryMappings).orderBy(asc(quickBooksCategoryMappings.category)),
    db.select().from(quickBooksExports).where(inArray(quickBooksExports.status, ['pending_mapping', 'pending_approval', 'ready', 'failed'])).orderBy(desc(quickBooksExports.createdAt)).limit(20),
    db.select().from(inventoryLowStockAlerts).where(inArray(inventoryLowStockAlerts.status, ['open', 'acknowledged'])).orderBy(desc(inventoryLowStockAlerts.createdAt)),
    db.select().from(monthlyInventoryReports).orderBy(desc(monthlyInventoryReports.reportMonth)).limit(12),
  ])
  const locationMap = new Map(locations.map((row) => [row.id, row]))
  const productMap = new Map(productRows.map((row) => [row.id, row]))
  const balanceMap = new Map(balances.map((row) => [`${row.locationId}:${row.productId}`, row]))
  const thresholdMap = new Map(thresholds.map((row) => [`${row.locationId}:${row.productId}`, row]))
  const openReplenishmentCount = replenishments.length
  const qbAttention = exports.length

  return <div className="space-y-6 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-slate-900">Sample Inventory</h1><p className="text-sm text-slate-500">Location stock, sample usage, replenishment, and accounting categorization.</p></div>
      <Button asChild><Link href="/admin/sample-inventory/new"><Plus className="mr-2 h-4 w-4" />New sample request</Link></Button>
    </div>

    <div className="grid gap-4 md:grid-cols-4">
      <Metric icon={<Warehouse />} label="Locations" value={locations.length} />
      <Metric icon={<ArrowRightLeft />} label="Open replenishments" value={openReplenishmentCount} />
      <Metric icon={<AlertTriangle />} label="Low-stock alerts" value={alerts.length} />
      <Metric icon={<ReceiptText />} label="QB items needing attention" value={qbAttention} />
    </div>

    <Card><CardHeader><CardTitle>Location inventory</CardTitle></CardHeader><CardContent className="space-y-6">
      {locations.map((location) => <section key={location.id} className="rounded-xl border border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold">{location.name}</h2><p className="text-xs text-slate-500">{location.type === 'warehouse' ? 'Main warehouse' : 'Sample location'}{location.region ? ` · ${location.region}` : ''}</p></div><Badge variant="outline">{location.type}</Badge></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="py-2">SKU / Product</th><th>On hand</th><th>Minimum</th><th>Set audited balance</th></tr></thead><tbody>
          {productRows.map((product) => { const key = `${location.id}:${product.id}`; const balance = balanceMap.get(key); const threshold = thresholdMap.get(key); return <tr key={product.id} className="border-b border-slate-100 align-top"><td className="py-3 pr-4"><strong>{product.sku}</strong><br/><span className="text-slate-500">{product.name}</span></td><td className="whitespace-nowrap py-3 pr-4">{balance?.quantityCases ?? 0} cases<br/>{balance?.quantityBottles ?? 0} bottles</td><td className="py-3 pr-4"><form action={formAction(saveLocationThreshold)} className="flex flex-wrap gap-2"><input type="hidden" name="locationId" value={location.id}/><input type="hidden" name="productId" value={product.id}/><input className={`${input} w-20`} name="minimumCases" type="number" min="0" defaultValue={threshold?.minimumCases ?? 0} aria-label="Minimum cases"/><input className={`${input} w-20`} name="minimumBottles" type="number" min="0" defaultValue={threshold?.minimumBottles ?? 0} aria-label="Minimum bottles"/><Button size="sm" variant="outline">Save</Button></form></td><td className="py-3"><form action={formAction(setLocationBalance)} className="flex flex-wrap gap-2"><input type="hidden" name="locationId" value={location.id}/><input type="hidden" name="productId" value={product.id}/><input className={`${input} w-20`} name="quantityCases" type="number" min="0" defaultValue={balance?.quantityCases ?? 0} aria-label="Cases on hand"/><input className={`${input} w-20`} name="quantityBottles" type="number" min="0" defaultValue={balance?.quantityBottles ?? 0} aria-label="Bottles on hand"/><input className={`${input} min-w-44`} name="reason" required placeholder="Reason for adjustment"/><Button size="sm">Update</Button></form></td></tr> })}
        </tbody></table></div>
      </section>)}
    </CardContent></Card>

    <div className="grid gap-6 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>Recent sample requests</CardTitle></CardHeader><CardContent className="space-y-3">{requests.length ? requests.map((request) => <div key={request.id} className="flex items-start justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{request.requestNumber} · {request.recipientName}</p><p className="text-sm text-slate-500">{locationMap.get(request.sourceLocationId)?.name} · {request.quickBooksCategory}</p><p className="text-xs text-slate-400">{request.purpose}</p></div><Badge>{request.status.replaceAll('_', ' ')}</Badge></div>) : <Empty text="No sample requests yet."/>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Open replenishments</CardTitle></CardHeader><CardContent className="space-y-3">{replenishments.length ? replenishments.map((item) => <div key={item.id} className="rounded-lg border p-3"><p className="font-medium">{productMap.get(item.productId)?.name}</p><p className="text-sm text-slate-500">{locationMap.get(item.sourceLocationId)?.name} → {locationMap.get(item.destinationLocationId)?.name}</p><p className="mb-3 text-sm">Remaining: {item.requestedCases - item.fulfilledCases} cases / {item.requestedBottles - item.fulfilledBottles} bottles</p><form action={formAction(fulfillReplenishment)} className="flex flex-wrap gap-2"><input type="hidden" name="replenishmentId" value={item.id}/><input className={`${input} w-24`} name="quantityCases" type="number" min="0" max={item.requestedCases - item.fulfilledCases} defaultValue={item.requestedCases - item.fulfilledCases} aria-label="Cases to fulfill"/><input className={`${input} w-24`} name="quantityBottles" type="number" min="0" max={item.requestedBottles - item.fulfilledBottles} defaultValue={item.requestedBottles - item.fulfilledBottles} aria-label="Bottles to fulfill"/><Button size="sm">Record transfer</Button></form></div>) : <Empty text="No open replenishments."/>}</CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>QuickBooks category mappings</CardTitle></CardHeader><CardContent><div className="grid gap-4 xl:grid-cols-2">{mappings.map((mapping) => <form action={formAction(saveQuickBooksMapping)} key={mapping.id} className="rounded-xl border p-4"><input type="hidden" name="category" value={mapping.category}/><h3 className="mb-3 font-semibold">{mapping.category}</h3><div className="grid gap-2 sm:grid-cols-2"><input className={input} name="accountId" defaultValue={mapping.accountId ?? ''} placeholder="QuickBooks account ID"/><input className={input} name="accountName" defaultValue={mapping.accountName ?? ''} placeholder="Account name"/><input className={input} name="classId" defaultValue={mapping.classId ?? ''} placeholder="Class ID"/><input className={input} name="className" defaultValue={mapping.className ?? ''} placeholder="Class name"/><input className={`${input} sm:col-span-2`} name="memoTemplate" defaultValue={mapping.memoTemplate ?? ''} placeholder="Memo template"/></div><div className="mt-3 flex flex-wrap items-center gap-4 text-sm"><label><input className="mr-2" type="checkbox" name="autoExport" defaultChecked={mapping.autoExport}/>Auto-export when integration is connected</label><label><input className="mr-2" type="checkbox" name="requiresApproval" defaultChecked={mapping.requiresApproval}/>Require approval</label><Button size="sm">Save mapping</Button></div></form>)}</div></CardContent></Card>

    <Card><CardHeader><CardTitle>QuickBooks export queue</CardTitle></CardHeader><CardContent className="space-y-3">{exports.length ? exports.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">Sample request {item.sampleRequestId.slice(0, 8)}</p><Badge variant="outline">{item.status.replaceAll('_', ' ')}</Badge>{item.lastError && <p className="text-sm text-red-600">{item.lastError}</p>}</div><form action={formAction(markQuickBooksExported)} className="flex gap-2"><input type="hidden" name="exportId" value={item.id}/><input className={input} name="externalTransactionId" required placeholder="QuickBooks transaction ID"/><Button size="sm">Mark exported</Button></form></div>) : <Empty text="Nothing is waiting for export."/>}</CardContent></Card>

    <Card><CardHeader><CardTitle>Monthly reports</CardTitle></CardHeader><CardContent className="space-y-2">{reports.length ? reports.map((report) => <div key={report.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{report.reportMonth}</p><p className="text-xs text-slate-500">{report.status.replaceAll('_', ' ')} · {report.sentRecipientEmails.length}/{report.recipientEmails.length} recipients</p></div>{report.csvContent && <Button asChild size="sm" variant="outline"><Link href={`/api/sample-inventory/reports/${report.id}/csv`}><Download className="mr-2 h-4 w-4"/>CSV</Link></Button>} {report.csvContent && <Button asChild size="sm" variant="outline"><Link href={`/api/sample-inventory/reports/${report.id}/pdf`}><Download className="mr-2 h-4 w-4"/>PDF</Link></Button>}</div>) : <Empty text="Reports appear after the first monthly run."/>}</CardContent></Card>
  </div>
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <Card><CardContent className="flex items-center gap-3 p-4"><span className="rounded-lg bg-blue-50 p-2 text-blue-600 [&>svg]:h-5 [&>svg]:w-5">{icon}</span><div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-slate-500">{label}</p></div></CardContent></Card> }
function Empty({ text }: { text: string }) { return <div className="py-8 text-center text-sm text-slate-500"><Package className="mx-auto mb-2 h-6 w-6"/>{text}</div> }


