const HUBSPOT_API_URL = 'https://api.hubapi.com'

export interface HubSpotCompany {
  id: string
  name: string
  domain: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  industry: string | null
  annualRevenue: string | null
  numberOfEmployees: string | null
  website: string | null
}

// Detect key format: legacy UUID keys use hapikey param; Private App tokens use Bearer
function buildHubSpotHeaders(apiKey: string): { headers: Record<string, string>; keyParam?: string } {
  const isLegacy = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(apiKey)
  if (isLegacy) return { headers: { 'Content-Type': 'application/json' }, keyParam: apiKey }
  return { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` } }
}

export async function getHubSpotCompanies(): Promise<{ companies: HubSpotCompany[]; error?: string }> {
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) return { companies: [], error: 'HUBSPOT_API_KEY not set' }

  const { headers, keyParam } = buildHubSpotHeaders(apiKey)

  const properties = [
    'name', 'domain', 'phone', 'address', 'city', 'state', 'zip',
    'industry', 'annualrevenue', 'numberofemployees', 'website',
  ].join(',')

  let all: HubSpotCompany[] = []
  let after: string | undefined

  do {
    const url = new URL(`${HUBSPOT_API_URL}/crm/v3/objects/companies`)
    url.searchParams.set('limit', '100')
    url.searchParams.set('properties', properties)
    if (after) url.searchParams.set('after', after)
    if (keyParam) url.searchParams.set('hapikey', keyParam)

    const res = await fetch(url.toString(), {
      headers,
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('HubSpot companies fetch failed:', res.status, err)
      return { companies: [], error: `HubSpot API error ${res.status}: ${err.message ?? 'Unknown error'}` }
    }
    const data = await res.json()

    all = all.concat(
      (data.results ?? []).map((r: { id: string; properties: Record<string, string> }) => ({
        id: r.id,
        name: r.properties.name ?? '',
        domain: r.properties.domain ?? null,
        phone: r.properties.phone ?? null,
        address: r.properties.address ?? null,
        city: r.properties.city ?? null,
        state: r.properties.state ?? null,
        zip: r.properties.zip ?? null,
        industry: r.properties.industry ?? null,
        annualRevenue: r.properties.annualrevenue ?? null,
        numberOfEmployees: r.properties.numberofemployees ?? null,
        website: r.properties.website ?? null,
      }))
    )

    after = data.paging?.next?.after
  } while (after)

  return { companies: all.sort((a, b) => a.name.localeCompare(b.name)) }
}

export async function updateHubSpotCompany(
  id: string,
  props: Partial<Pick<HubSpotCompany, 'name' | 'phone' | 'address' | 'city' | 'state' | 'zip' | 'website' | 'industry'>>
): Promise<boolean> {
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) return false

  const { headers, keyParam } = buildHubSpotHeaders(apiKey)
  const kp = keyParam ? `?hapikey=${keyParam}` : ''

  const properties: Record<string, string> = {}
  if (props.name !== undefined) properties.name = props.name
  if (props.phone !== undefined) properties.phone = props.phone ?? ''
  if (props.address !== undefined) properties.address = props.address ?? ''
  if (props.city !== undefined) properties.city = props.city ?? ''
  if (props.state !== undefined) properties.state = props.state ?? ''
  if (props.zip !== undefined) properties.zip = props.zip ?? ''
  if (props.website !== undefined) properties.website = props.website ?? ''
  if (props.industry !== undefined) properties.industry = props.industry ?? ''

  const res = await fetch(`${HUBSPOT_API_URL}/crm/v3/objects/companies/${id}${kp}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ properties }),
  })

  return res.ok
}

export interface HubSpotContactRecord {
  id: string
  email: string | null
  firstname: string | null
  lastname: string | null
  phone: string | null
  company: string | null
  jobtitle: string | null
  lastmodifieddate: string | null
}

export interface HubSpotCompanyContactRecord {
  id: string
  email: string | null
  firstname: string | null
  lastname: string | null
  phone: string | null
  jobtitle: string | null
}

export async function fetchHubSpotContactsUpdatedSince(sinceMs: number): Promise<HubSpotContactRecord[]> {
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) return []

  const { headers, keyParam } = buildHubSpotHeaders(apiKey)
  const kp = keyParam ? `?hapikey=${keyParam}` : ''

  const sinceStr = new Date(sinceMs).toISOString()
  const all: HubSpotContactRecord[] = []
  let after: string | undefined

  do {
    const res = await fetch(`${HUBSPOT_API_URL}/crm/v3/objects/contacts/search${kp}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filterGroups: [{
          filters: [{ propertyName: 'lastmodifieddate', operator: 'GTE', value: sinceStr }]
        }],
        properties: ['email', 'firstname', 'lastname', 'phone', 'company', 'jobtitle', 'lastmodifieddate'],
        limit: 100,
        ...(after ? { after } : {}),
      }),
    })

    if (!res.ok) break

    const data = await res.json()
    for (const r of data.results ?? []) {
      const p = r.properties ?? {}
      all.push({
        id: r.id,
        email: p.email ?? null,
        firstname: p.firstname ?? null,
        lastname: p.lastname ?? null,
        phone: p.phone ?? null,
        company: p.company ?? null,
        jobtitle: p.jobtitle ?? null,
        lastmodifieddate: p.lastmodifieddate ?? null,
      })
    }

    after = data.paging?.next?.after
  } while (after)

  return all
}

export async function getHubSpotCompanyContacts(companyId: string): Promise<HubSpotCompanyContactRecord[]> {
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) return []

  const { headers, keyParam } = buildHubSpotHeaders(apiKey)
  const associatedIds: string[] = []
  let after: string | undefined

  do {
    const url = new URL(`${HUBSPOT_API_URL}/crm/v3/objects/companies/${companyId}/associations/contacts`)
    url.searchParams.set('limit', '100')
    if (after) url.searchParams.set('after', after)
    if (keyParam) url.searchParams.set('hapikey', keyParam)

    const res = await fetch(url.toString(), {
      headers,
      cache: 'no-store',
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('HubSpot company contacts fetch failed:', res.status, err)
      return []
    }

    const data = await res.json()
    associatedIds.push(
      ...(data.results ?? [])
        .map((result: { id?: string }) => (typeof result.id === 'string' ? result.id : null))
        .filter((id: string | null): id is string => Boolean(id))
    )
    after = data.paging?.next?.after
  } while (after)

  if (!associatedIds.length) return []

  const batchUrl = new URL(`${HUBSPOT_API_URL}/crm/v3/objects/contacts/batch/read`)
  if (keyParam) batchUrl.searchParams.set('hapikey', keyParam)

  const res = await fetch(batchUrl.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      properties: ['email', 'firstname', 'lastname', 'phone', 'jobtitle'],
      inputs: associatedIds.map((id) => ({ id })),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error('HubSpot contact batch read failed:', res.status, err)
    return []
  }

  const data = await res.json()
  return (data.results ?? []).map((result: { id: string; properties?: Record<string, string> }) => ({
    id: result.id,
    email: result.properties?.email ?? null,
    firstname: result.properties?.firstname ?? null,
    lastname: result.properties?.lastname ?? null,
    phone: result.properties?.phone ?? null,
    jobtitle: result.properties?.jobtitle ?? null,
  }))
}

interface HubSpotContactProps {
  email: string
  firstname: string
  lastname: string
  company: string
  phone: string
  city: string
  state: string
  credit_limit: string
  payment_terms: string
  account_balance: string
}

export async function upsertHubSpotContact(props: HubSpotContactProps): Promise<string | null> {
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey || !props.email) return null

  const { headers, keyParam } = buildHubSpotHeaders(apiKey)
  const kp = keyParam ? `?hapikey=${keyParam}` : ''

  // Search for existing contact by email
  const searchRes = await fetch(`${HUBSPOT_API_URL}/crm/v3/objects/contacts/search${kp}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: props.email }] }],
      properties: ['hs_object_id'],
    }),
  })

  const searchData = await searchRes.json()
  const existing = searchData.results?.[0]

  const properties = {
    email: props.email,
    firstname: props.firstname,
    lastname: props.lastname,
    company: props.company,
    phone: props.phone,
    city: props.city,
    state: props.state,
    credit_limit: props.credit_limit,
    payment_terms: props.payment_terms,
    account_balance: props.account_balance,
  }

  if (existing) {
    const id = existing.id
    await fetch(`${HUBSPOT_API_URL}/crm/v3/objects/contacts/${id}${kp}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ properties }),
    })
    return id
  } else {
    const createRes = await fetch(`${HUBSPOT_API_URL}/crm/v3/objects/contacts${kp}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ properties }),
    })
    const created = await createRes.json()
    return created.id ?? null
  }
}
