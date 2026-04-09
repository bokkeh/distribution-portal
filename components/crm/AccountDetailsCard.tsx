'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PhoneSmsButton } from '@/components/crm/PhoneSmsButton'
import { formatCurrency } from '@/lib/utils'
import { Bell, Building2, Clock, CreditCard, FileText, Globe, Mail, MapPin, Phone, ShieldCheck, User } from 'lucide-react'

type AccountDetails = {
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
  liquorLicenseNumber?: string | null
  liquorLicenseState?: string | null
  liquorLicenseExpiration?: string | null
  liquorLicenseUrl?: string | null
}

function settingsAnchorHref(mode: 'admin' | 'staff' | 'sales', accountId: string, anchor: string) {
  return mode === 'sales'
    ? `/sales/accounts/${accountId}?tab=settings#${anchor}`
    : `/${mode}/crm/${accountId}?tab=settings#${anchor}`
}

function directionsUrl(account: AccountDetails) {
  const fullAddress = [account.address, account.city, account.state, account.zip].filter(Boolean).join(', ')
  if (!fullAddress) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
}

function NotificationPreferenceBadge({ value }: { value: string | null | undefined }) {
  const pref = value ?? 'email'
  if (pref === 'sms') return <Badge variant="info">SMS only</Badge>
  if (pref === 'both') {
    return (
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="info">SMS</Badge>
        <Badge variant="secondary">Email</Badge>
      </div>
    )
  }
  return <Badge variant="secondary">Email only</Badge>
}

function normalizeWebsiteUrl(value: string | null | undefined) {
  const website = value?.trim()
  if (!website) return null
  return /^https?:\/\//i.test(website) ? website : `https://${website}`
}

function LicenseExpiryBadge({ expiration }: { expiration: string | null | undefined }) {
  if (!expiration) return null
  const exp = new Date(expiration)
  if (isNaN(exp.getTime())) return <span className="text-slate-900">{expiration}</span>
  const now = new Date()
  const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const formatted = exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (daysUntil < 0) return <span className="font-semibold text-red-600">{formatted} — EXPIRED</span>
  if (daysUntil <= 30) return <span className="font-semibold text-amber-600">{formatted} — expires in {daysUntil}d</span>
  return <span className="text-slate-900">{formatted}</span>
}

export function AccountDetailsCard({
  account,
  mode,
}: {
  account: AccountDetails
  mode: 'admin' | 'staff' | 'sales'
}) {
  const mapUrl = directionsUrl(account)
  const cityLine = [account.city, account.state, account.zip].filter(Boolean).join(', ')
  const websiteUrl = normalizeWebsiteUrl(account.website)
  const hasLicense = account.liquorLicenseNumber || account.liquorLicenseState || account.liquorLicenseExpiration || account.liquorLicenseUrl

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Account Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Address</p>
            {account.address ? (
              <>
                {mapUrl ? (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block text-slate-900 hover:text-blue-600 hover:underline"
                  >
                    {account.address}
                  </a>
                ) : (
                  <p className="mt-1 text-slate-900">{account.address}</p>
                )}
                {cityLine ? <p className="text-muted-foreground">{cityLine}</p> : null}
                {mapUrl ? (
                  <div className="mt-2">
                    <a href={mapUrl} target="_blank" rel="noreferrer">
                      <Button type="button" variant="outline" size="sm">Get Directions</Button>
                    </a>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="mt-1 text-muted-foreground">Address not set</p>
            )}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</p>
              {account.phone ? (
                <div className="mt-1">
                  <PhoneSmsButton
                    phone={account.phone}
                    recipientName={account.companyName}
                    accountId={account.id}
                    showIcon={false}
                    className="text-sm"
                  />
                </div>
              ) : (
                <p className="mt-1 text-muted-foreground">No phone on file</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Point of Contact</p>
              <p className="mt-1 text-slate-900">{account.pocName?.trim() || 'No POC assigned'}</p>
              {!account.pocName?.trim() ? (
                <Link href={settingsAnchorHref(mode, account.id, 'poc-fields')} className="mt-1 inline-block text-xs font-medium text-blue-600 hover:underline">
                  Add POC
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
              {account.pocEmail ? (
                <a href={`mailto:${account.pocEmail}`} className="mt-1 inline-block truncate text-blue-600 hover:underline">
                  {account.pocEmail}
                </a>
              ) : (
                <p className="mt-1 text-muted-foreground">No email on file</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hours</p>
              <p className="mt-1 text-slate-900">{account.hoursOfOperation?.trim() || 'Hours not set'}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex items-start gap-3">
            <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Website</p>
              {websiteUrl ? (
                <a href={websiteUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block truncate text-blue-600 hover:underline">
                  {account.website}
                </a>
              ) : (
                <p className="mt-1 text-muted-foreground">No website on file</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Credit Limit</p>
              <p className="mt-1 text-slate-900">{formatCurrency(account.creditLimit ?? '0')}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notification Preference</p>
              <div className="mt-1">
                <NotificationPreferenceBadge value={account.notificationPreference} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Liquor License</p>
            {hasLicense ? (
              <div className="mt-1 space-y-1">
                {account.liquorLicenseNumber ? (
                  <p className="text-slate-900">
                    <span className="text-muted-foreground">No.&nbsp;</span>{account.liquorLicenseNumber}
                    {account.liquorLicenseState ? <span className="ml-1 text-muted-foreground">({account.liquorLicenseState})</span> : null}
                  </p>
                ) : null}
                {account.liquorLicenseExpiration ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Expires&nbsp;</span>
                    <LicenseExpiryBadge expiration={account.liquorLicenseExpiration} />
                  </p>
                ) : null}
                {account.liquorLicenseUrl ? (
                  <a href={account.liquorLicenseUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
                    <FileText className="h-3.5 w-3.5" />
                    View license document
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <p className="text-muted-foreground">No license on file</p>
                <Link href={settingsAnchorHref(mode, account.id, 'license-fields')} className="text-xs font-medium text-blue-600 hover:underline">Add</Link>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
