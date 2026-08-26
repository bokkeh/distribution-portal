import { ilike, or } from 'drizzle-orm'
import { db } from '@/db'
import { customerAccounts } from '@/db/schema'

export type AccountSearchMatch = {
  id: string
  companyName: string
  contactName: string | null
  city: string | null
  state: string | null
  email: string | null
  phone: string | null
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function editDistance(left: string, right: string) {
  if (left === right) return 0
  if (!left.length) return right.length
  if (!right.length) return left.length

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      )
    }
    previous.splice(0, previous.length, ...current)
  }

  return previous[right.length]
}

function getMatchScore(row: AccountSearchMatch, query: string) {
  const normalizedCompany = normalizeSearchText(row.companyName)
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return 0

  const compactCompany = normalizedCompany.replace(/\s/g, '')
  const compactQuery = normalizedQuery.replace(/\s/g, '')
  if (compactCompany === compactQuery) return 120
  if (compactCompany.startsWith(compactQuery)) return 110 - Math.min(compactCompany.length - compactQuery.length, 10)
  if (compactCompany.includes(compactQuery)) return 100 - Math.min(compactCompany.indexOf(compactQuery), 10)

  const searchableValues = [
    ...normalizedCompany.split(' '),
    normalizeSearchText(row.contactName ?? ''),
    normalizeSearchText(row.email ?? ''),
    normalizeSearchText(row.phone ?? ''),
    normalizeSearchText([row.city, row.state].filter(Boolean).join(' ')),
  ].filter(Boolean)

  if (searchableValues.some((value) => value.replace(/\s/g, '').includes(compactQuery))) return 96

  let bestDistance = Number.POSITIVE_INFINITY
  for (const value of searchableValues) {
    const comparable = value.length > compactQuery.length + 3
      ? value.slice(0, compactQuery.length)
      : value
    bestDistance = Math.min(bestDistance, editDistance(compactQuery, comparable.replace(/\s/g, '')))
  }

  return Math.max(0, 90 - bestDistance * 14)
}

export async function searchAccounts(query: string, limit = 8) {
  const trimmedQuery = query.trim()
  if (trimmedQuery.length < 2) return [] as AccountSearchMatch[]

  const like = `%${trimmedQuery}%`
  const selectFields = {
    id: customerAccounts.id,
    companyName: customerAccounts.companyName,
    contactName: customerAccounts.contactName,
    city: customerAccounts.city,
    state: customerAccounts.state,
    email: customerAccounts.email,
    phone: customerAccounts.phone,
  }

  const exactRowsPromise = db
    .select(selectFields)
    .from(customerAccounts)
    .where(or(
      ilike(customerAccounts.companyName, like),
      ilike(customerAccounts.contactName, like),
      ilike(customerAccounts.email, like),
      ilike(customerAccounts.phone, like),
      ilike(customerAccounts.city, like),
    ))
    .limit(Math.max(limit * 3, 24))

  const normalizedQuery = normalizeSearchText(trimmedQuery).replace(/\s/g, '')
  const candidateRowsPromise = normalizedQuery.length >= 4
    ? db
      .select(selectFields)
      .from(customerAccounts)
      .where(ilike(customerAccounts.companyName, `%${normalizedQuery.slice(0, 3)}%`))
      .limit(Math.max(limit * 8, 64))
    : Promise.resolve([] as AccountSearchMatch[])

  const [exactRows, candidateRows] = await Promise.all([exactRowsPromise, candidateRowsPromise])

  const uniqueRows = new Map<string, AccountSearchMatch>()
  for (const row of [...exactRows, ...candidateRows]) uniqueRows.set(row.id, row)

  return Array.from(uniqueRows.values())
    .map((row) => ({ row, score: getMatchScore(row, trimmedQuery) }))
    .filter(({ score }) => score >= 48)
    .sort((left, right) => right.score - left.score || left.row.companyName.localeCompare(right.row.companyName))
    .slice(0, limit)
    .map(({ row }) => row)
}
