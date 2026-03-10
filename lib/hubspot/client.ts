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

export async function getHubSpotCompanies(): Promise<HubSpotCompany[]> {
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) return []

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

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 300 }, // cache 5 min
    })

    if (!res.ok) break
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

  return all.sort((a, b) => a.name.localeCompare(b.name))
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

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  // Search for existing contact by email
  const searchRes = await fetch(`${HUBSPOT_API_URL}/crm/v3/objects/contacts/search`, {
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
    await fetch(`${HUBSPOT_API_URL}/crm/v3/objects/contacts/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ properties }),
    })
    return id
  } else {
    const createRes = await fetch(`${HUBSPOT_API_URL}/crm/v3/objects/contacts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ properties }),
    })
    const created = await createRes.json()
    return created.id ?? null
  }
}
