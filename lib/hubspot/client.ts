const HUBSPOT_API_URL = 'https://api.hubapi.com'

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
