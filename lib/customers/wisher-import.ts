type ParsedCsvRow = Record<string, string>

export type WisherImportRow = {
  externalCustomerId: string | null
  companyName: string
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  note: string | null
  tags: string | null
}

const REQUIRED_HEADERS = ['Customer ID', 'Email'] as const

function cleanCell(value: string | undefined) {
  const trimmed = (value ?? '').trim()
  return trimmed.length ? trimmed : null
}

function cleanExternalCustomerId(value: string | undefined) {
  const trimmed = (value ?? '').trim().replace(/^'+/, '')
  return trimmed.length ? trimmed : null
}

function combineAddress(address1: string | null, address2: string | null) {
  return [address1, address2].filter(Boolean).join(', ') || null
}

function combineName(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(' ').trim() || null
}

function fallbackCompanyName(contactName: string | null, email: string | null, externalCustomerId: string | null) {
  if (contactName) return contactName
  if (email) return email
  return externalCustomerId ? `Wisher Customer ${externalCustomerId}` : 'Wisher Customer'
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === ',') {
      currentRow.push(currentCell)
      currentCell = ''
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') index += 1
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentRow = []
      currentCell = ''
      continue
    }

    currentCell += char
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell)
    rows.push(currentRow)
  }

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0))
}

export function parseWisherCustomersCsv(text: string): {
  rows: WisherImportRow[]
  invalidRows: number
} {
  const parsedRows = parseCsv(text)
  if (parsedRows.length === 0) {
    throw new Error('The CSV file is empty.')
  }

  const headers = parsedRows[0].map((header) => header.trim())
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header))
  if (missingHeaders.length > 0) {
    throw new Error(`The CSV is missing required columns: ${missingHeaders.join(', ')}.`)
  }

  const rows: WisherImportRow[] = []
  let invalidRows = 0

  for (const values of parsedRows.slice(1)) {
    const record = headers.reduce<ParsedCsvRow>((accumulator, header, index) => {
      accumulator[header] = values[index] ?? ''
      return accumulator
    }, {})

    const externalCustomerId = cleanExternalCustomerId(record['Customer ID'])
    const firstName = cleanCell(record['First Name'])
    const lastName = cleanCell(record['Last Name'])
    const email = cleanCell(record['Email'])?.toLowerCase() ?? null
    const phone = cleanCell(record['Phone']) ?? cleanCell(record['Default Address Phone'])
    const contactName = combineName(firstName, lastName)
    const companyName = cleanCell(record['Default Address Company']) ?? fallbackCompanyName(contactName, email, externalCustomerId)

    if (!externalCustomerId && !email && !phone) {
      invalidRows += 1
      continue
    }

    rows.push({
      externalCustomerId,
      companyName,
      contactName,
      email,
      phone,
      address: combineAddress(cleanCell(record['Default Address Address1']), cleanCell(record['Default Address Address2'])),
      city: cleanCell(record['Default Address City']),
      state: cleanCell(record['Default Address Province Code']),
      zip: cleanCell(record['Default Address Zip']),
      note: cleanCell(record['Note']),
      tags: cleanCell(record['Tags']),
    })
  }

  return { rows, invalidRows }
}
