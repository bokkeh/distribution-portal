/**
 * HubSpot two-way sync — pulls contact updates from HubSpot and applies them
 * to matching portal contacts (matched by hubspotContactId).
 *
 * Run via cron: GET /api/cron/hubspot-sync
 * Authorization: Bearer <CRON_SECRET>
 *
 * Only updates fields that HubSpot has changed since the last 24 hours to
 * avoid overwriting portal-only data.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { contacts } from '@/db/schema'
import { eq, isNotNull } from 'drizzle-orm'
import { fetchHubSpotContactsUpdatedSince } from '@/lib/hubspot/client'

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since = Date.now() - 24 * 60 * 60 * 1000 // last 24h

  // Fetch updated contacts from HubSpot
  const hubspotContacts = await fetchHubSpotContactsUpdatedSince(since)
  if (hubspotContacts.length === 0) {
    return NextResponse.json({ synced: 0, message: 'No HubSpot updates in last 24h' })
  }

  // Build a map of hubspotId → updates
  const hubspotMap = new Map(hubspotContacts.map(c => [c.id, c]))

  // Find all portal contacts with a hubspotContactId
  const portalContacts = await db
    .select({ id: contacts.id, hubspotContactId: contacts.hubspotContactId, name: contacts.name, email: contacts.email, phone: contacts.phone, title: contacts.title })
    .from(contacts)
    .where(isNotNull(contacts.hubspotContactId))

  let synced = 0
  let skipped = 0

  for (const pc of portalContacts) {
    if (!pc.hubspotContactId) continue
    const hs = hubspotMap.get(pc.hubspotContactId)
    if (!hs) continue

    const fullName = [hs.firstname, hs.lastname].filter(Boolean).join(' ').trim()
    const updates: Partial<typeof contacts.$inferInsert> = {}

    if (fullName && fullName !== pc.name) updates.name = fullName
    if (hs.email && hs.email !== pc.email) updates.email = hs.email
    if (hs.phone && hs.phone !== pc.phone) updates.phone = hs.phone
    if (hs.jobtitle && hs.jobtitle !== pc.title) updates.title = hs.jobtitle

    if (Object.keys(updates).length === 0) {
      skipped++
      continue
    }

    await db.update(contacts).set(updates).where(eq(contacts.id, pc.id))
    synced++
  }

  return NextResponse.json({
    hubspotUpdates: hubspotContacts.length,
    portalContactsChecked: portalContacts.length,
    synced,
    skipped,
  })
}
