import { db } from '@/db'
import { tastingReports, tasterInvoices, users, customerAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { requireFeature } from '@/lib/auth/session'
import { getTastingById } from '@/lib/tastings/read'
import { formatEasternDateTime } from '@/lib/tastings/time'
import { updateTastingStatus, deleteTasting, reassignTasting } from '@/actions/tastings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Calendar, MapPin, Phone, User, FileText, Receipt, StickyNote } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  requested: 'text-violet-700 border-violet-200 bg-violet-50',
  scheduled: 'text-blue-700 border-blue-200 bg-blue-50',
  confirmed: 'text-green-700 border-green-200 bg-green-50',
  completed: 'text-slate-700 border-slate-200 bg-slate-50',
  cancelled: 'text-red-700 border-red-200 bg-red-50',
  declined: 'text-orange-700 border-orange-200 bg-orange-50',
}

export default async function AdminTastingDetailPage({
  params,
}: {
  params: Promise<{ tastingId: string }>
}) {
  await requireFeature('tastings', 'admin', 'staff')

  const { tastingId } = await params
  const tasting = await getTastingById(tastingId)
  if (!tasting) notFound()

  const [account, taster, report, invoice, allTasters] = await Promise.all([
    db.select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      phone: customerAccounts.phone,
      address: customerAccounts.address,
      city: customerAccounts.city,
      state: customerAccounts.state,
    }).from(customerAccounts).where(eq(customerAccounts.id, tasting.customerId)).limit(1).then(r => r[0] ?? null),

    db.select({ id: users.id, name: users.name, phone: users.phone, email: users.email })
      .from(users).where(eq(users.id, tasting.assignedUserId)).limit(1).then(r => r[0] ?? null),

    db.select().from(tastingReports).where(eq(tastingReports.tastingId, tastingId)).limit(1).then(r => r[0] ?? null),

    db.select().from(tasterInvoices).where(eq(tasterInvoices.tastingId, tastingId)).limit(1).then(r => r[0] ?? null),

    db.select({ id: users.id, name: users.name, roles: users.roles })
      .from(users)
      .where(eq(users.active, true))
      .orderBy(users.name)
      .then(rows => rows.filter(u => u.roles?.includes('taster'))),
  ])

  const canChangeStatus = tasting.status !== 'completed' && tasting.status !== 'cancelled' && tasting.status !== 'declined'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/admin/tastings" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-3">
          <ArrowLeft className="w-3.5 h-3.5" />
          All Tastings
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{tasting.eventName}</h1>
            <p className="text-slate-500 mt-0.5">{account?.companyName}</p>
          </div>
          <Badge variant="outline" className={`capitalize text-sm px-2.5 py-1 ${STATUS_COLORS[tasting.status] ?? ''}`}>
            {tasting.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Details card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                Event Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-400">Scheduled</span>
                  <p className="font-medium">{formatEasternDateTime(tasting.scheduledAt)}</p>
                </div>
                {tasting.endAt && (
                  <div>
                    <span className="text-xs text-slate-400">End Time</span>
                    <p className="font-medium">{formatEasternDateTime(tasting.endAt)}</p>
                  </div>
                )}
                {tasting.checkedInAt && (
                  <div>
                    <span className="text-xs text-slate-400">Checked In</span>
                    <p className="font-medium">{formatEasternDateTime(tasting.checkedInAt)}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-slate-400">Created</span>
                  <p className="font-medium">{new Date(tasting.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Training Day</span>
                  <p className="font-medium">{tasting.trainingDay ? 'Yes' : 'No'}</p>
                </div>
              </div>

              {(tasting.storeAddress || tasting.storeCity) && (
                <div className="flex items-start gap-2 pt-2 border-t text-slate-600">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                  <div>
                    {tasting.storeAddress && <p>{tasting.storeAddress}</p>}
                    {(tasting.storeCity || tasting.storeState || tasting.storeZip) && (
                      <p>{[tasting.storeCity, tasting.storeState, tasting.storeZip].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                </div>
              )}

              {tasting.storePhone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <a href={`tel:${tasting.storePhone}`} className="hover:text-blue-600">{tasting.storePhone}</a>
                </div>
              )}

              {tasting.notes && (
                <div className="flex items-start gap-2 pt-2 border-t">
                  <StickyNote className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                  <p className="text-slate-600 whitespace-pre-line">{tasting.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tasting report */}
          {report && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Tasting Report
                  <Badge variant="outline" className="ml-auto text-xs text-green-700 border-green-200 bg-green-50">Submitted</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {[
                  { label: 'Samples Served', value: report.samplesServed },
                  { label: 'Bottles Sold', value: report.bottlesSold },
                  { label: 'Cases Sold', value: report.casesSold },
                  { label: 'Consumer Interactions', value: report.consumerInteractions },
                ].map(({ label, value }) => value != null && (
                  <div key={label} className="bg-slate-50 rounded-lg p-2.5">
                    <span className="text-xs text-slate-400">{label}</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{value}</p>
                  </div>
                ))}
                {report.accountFeedback && (
                  <div className="col-span-full">
                    <span className="text-xs text-slate-400">Account Feedback</span>
                    <p className="text-slate-700 mt-0.5">{report.accountFeedback}</p>
                  </div>
                )}
                {report.highlights && (
                  <div className="col-span-full">
                    <span className="text-xs text-slate-400">Highlights</span>
                    <p className="text-slate-700 mt-0.5">{report.highlights}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Invoice */}
          {invoice && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-slate-400" />
                  Taster Invoice
                  <Badge variant="outline" className={`ml-auto text-xs capitalize ${invoice.status === 'approved' ? 'text-green-700 border-green-200 bg-green-50' : invoice.status === 'paid' ? 'text-slate-700 border-slate-200' : 'text-amber-700 border-amber-200 bg-amber-50'}`}>
                    {invoice.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {[
                  { label: 'Hours Worked', value: invoice.hoursWorked },
                  { label: 'Hourly Rate', value: invoice.hourlyRate ? `$${invoice.hourlyRate}` : null },
                  { label: 'Expenses', value: invoice.expenseAmount ? `$${invoice.expenseAmount}` : null },
                  { label: 'Total', value: invoice.totalAmount ? `$${invoice.totalAmount}` : null },
                ].map(({ label, value }) => value != null && (
                  <div key={label} className="bg-slate-50 rounded-lg p-2.5">
                    <span className="text-xs text-slate-400">{label}</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: people + actions */}
        <div className="space-y-4">
          {/* Account */}
          {account && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700">Account</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <Link href={`/admin/crm/${account.id}`} className="font-medium text-blue-600 hover:underline">
                  {account.companyName}
                </Link>
                {account.phone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <a href={`tel:${account.phone}`} className="hover:text-blue-600">{account.phone}</a>
                  </div>
                )}
                {(account.address || account.city) && (
                  <div className="flex items-start gap-2 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                    <span>{[account.address, account.city, account.state].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Taster */}
          {taster && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  Assigned Taster
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p className="font-medium">{taster.name}</p>
                {taster.phone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <a href={`tel:${taster.phone}`} className="hover:text-blue-600">{taster.phone}</a>
                  </div>
                )}
                {taster.email && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="text-xs text-slate-400">Email</span>
                    <a href={`mailto:${taster.email}`} className="hover:text-blue-600 truncate">{taster.email}</a>
                  </div>
                )}

                {/* Reassign */}
                {canChangeStatus && (
                  <form action={reassignTasting} className="pt-2 border-t">
                    <input type="hidden" name="tastingId" value={tastingId} />
                    <input type="hidden" name="mode" value="admin" />
                    <input type="hidden" name="redirectTo" value={`/admin/tastings/${tastingId}`} />
                    <label className="block text-xs text-slate-500 mb-1">Reassign to</label>
                    <div className="flex gap-2">
                      <select name="assignedUserId" defaultValue={tasting.assignedUserId} className="flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        {allTasters.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <Button type="submit" size="sm" variant="outline" className="text-xs shrink-0">Reassign</Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}

          {/* Status actions */}
          {canChangeStatus && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tasting.status === 'requested' && (
                  <form action={updateTastingStatus}>
                    <input type="hidden" name="tastingId" value={tastingId} />
                    <input type="hidden" name="status" value="scheduled" />
                    <input type="hidden" name="mode" value="admin" />
                    <input type="hidden" name="redirectTo" value={`/admin/tastings/${tastingId}`} />
                    <Button type="submit" className="w-full" size="sm">Approve Request</Button>
                  </form>
                )}
                {tasting.status === 'scheduled' && (
                  <form action={updateTastingStatus}>
                    <input type="hidden" name="tastingId" value={tastingId} />
                    <input type="hidden" name="status" value="confirmed" />
                    <input type="hidden" name="mode" value="admin" />
                    <input type="hidden" name="redirectTo" value={`/admin/tastings/${tastingId}`} />
                    <Button type="submit" className="w-full" size="sm">Mark Confirmed</Button>
                  </form>
                )}
                {tasting.status === 'confirmed' && (
                  <form action={updateTastingStatus}>
                    <input type="hidden" name="tastingId" value={tastingId} />
                    <input type="hidden" name="status" value="completed" />
                    <input type="hidden" name="mode" value="admin" />
                    <input type="hidden" name="redirectTo" value={`/admin/tastings/${tastingId}`} />
                    <Button type="submit" className="w-full" size="sm">Mark Completed</Button>
                  </form>
                )}
                <form action={updateTastingStatus}>
                  <input type="hidden" name="tastingId" value={tastingId} />
                  <input type="hidden" name="status" value="cancelled" />
                  <input type="hidden" name="mode" value="admin" />
                  <input type="hidden" name="redirectTo" value={`/admin/tastings/${tastingId}`} />
                  <ConfirmSubmitButton variant="destructive" className="w-full" size="sm" title="Cancel this tasting?" description="The assigned taster will be notified." confirmLabel="Cancel Tasting">Cancel Tasting</ConfirmSubmitButton>
                </form>
                <form action={deleteTasting}>
                  <input type="hidden" name="tastingId" value={tastingId} />
                  <input type="hidden" name="mode" value="admin" />
                  <ConfirmSubmitButton variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" size="sm" title="Archive this tasting as cancelled?" description="History, reports, and invoices will be preserved." confirmLabel="Archive as Cancelled">Archive as Cancelled</ConfirmSubmitButton>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
