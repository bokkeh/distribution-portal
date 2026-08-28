import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'

type OrderCandidate = {
  account_id: string
  account_name: string
  order_date: string
  cases: number
  source_total: number | null
  source_file: string
  source_sheet: string
  source_row: number
  source_account: string
  source_notes: string | null
}

type TastingCandidate = {
  account_id: string
  account_name: string
  assigned_user_id: string
  assigned_user_name: string
  date: string
  scheduled_at: string
  end_at: string
  status: 'completed' | 'cancelled'
  source_file: string
  source_sheet: string
  source_row: number
  source_account: string
  source_taster: string | null
  activity_type: string
  samples_served: number | null
  bottles_sold: number | null
  consumer_interactions: number | null
  bottles_in_stock_before: number | null
  bottle_price_on_shelf: number | null
  account_feedback: string | null
  highlights: string | null
  issues: string | null
  source_notes: string | null
}

type AuditFile = {
  import_tag: string
  order_insert_candidates: OrderCandidate[]
  tasting_insert_candidates: TastingCandidate[]
}

function money(value: number) {
  return value.toFixed(2)
}

function compact(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part?.trim())).join(' | ')
}

function orderKey(accountId: string, day: string, quantity: number) {
  return `${accountId}:${day}:${quantity.toFixed(2)}`
}

function tastingKey(accountId: string, day: string) {
  return `${accountId}:${day}`
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required.')

  const apply = process.argv.includes('--apply')
  const audit = JSON.parse(readFileSync('tmp/knowledge_audit.json', 'utf8')) as AuditFile
  const sql = neon(databaseUrl)

  const [existingOrderRows, existingTastingRows, productRows, creatorRows] = await Promise.all([
    sql`
      select o.customer_id, o.created_at, oi.quantity
      from orders o
      inner join order_items oi on oi.order_id = o.id
    `,
    sql`select customer_id, scheduled_at from tastings`,
    sql`select id, name from products where sku = 'WISH1' limit 1`,
    sql`
      select id, name, email
      from users
      where email = 'alex@ahawc.com' and role = 'admin'
      limit 1
    `,
  ])

  if (productRows.length !== 1) throw new Error('WISH1 product was not found.')
  if (creatorRows.length !== 1) throw new Error('alex@ahawc.com admin user was not found.')

  const productId = String(productRows[0].id)
  const productName = String(productRows[0].name)
  const creatorUserId = String(creatorRows[0].id)

  const existingOrderKeys = new Set(
    existingOrderRows.map((row) => orderKey(
      String(row.customer_id),
      new Date(String(row.created_at)).toISOString().slice(0, 10),
      Number(row.quantity),
    )),
  )
  const existingTastingKeys = new Set(
    existingTastingRows.map((row) => tastingKey(
      String(row.customer_id),
      new Date(String(row.scheduled_at)).toISOString().slice(0, 10),
    )),
  )

  const ordersToInsert = audit.order_insert_candidates.filter((row) => (
    !existingOrderKeys.has(orderKey(row.account_id, row.order_date, Number(row.cases)))
  ))
  const tastingsToInsert = audit.tasting_insert_candidates.filter((row) => (
    !existingTastingKeys.has(tastingKey(row.account_id, row.date))
  ))

  const preflight = {
    mode: apply ? 'apply' : 'dry-run',
    importTag: audit.import_tag,
    auditedOrders: audit.order_insert_candidates.length,
    ordersAlreadyPresentAtPreflight: audit.order_insert_candidates.length - ordersToInsert.length,
    ordersToInsert: ordersToInsert.length,
    auditedTastings: audit.tasting_insert_candidates.length,
    tastingsAlreadyPresentAtPreflight: audit.tasting_insert_candidates.length - tastingsToInsert.length,
    tastingsToInsert: tastingsToInsert.length,
  }

  if (!apply) {
    console.log(JSON.stringify(preflight, null, 2))
    return
  }

  const queries = []
  const insertedOrderIds: string[] = []
  const insertedTastingIds: string[] = []

  for (const row of ordersToInsert) {
    const orderId = randomUUID()
    const itemId = randomUUID()
    const activityId = randomUUID()
    const cases = Number(row.cases)
    const total = row.source_total == null ? cases * 150 : Number(row.source_total)
    const unitPrice = cases === 0 ? 0 : total / cases
    const createdAt = `${row.order_date}T12:00:00.000Z`
    const sourceKey = `${audit.import_tag}:order:${row.account_id}:${row.order_date}:${cases.toFixed(2)}`
    const notes = compact([
      `Historical import from '${row.source_file}' [${audit.import_tag}]`,
      `Sheet '${row.source_sheet}', row ${row.source_row}`,
      row.source_account !== row.account_name ? `Source account: ${row.source_account}` : null,
      row.source_notes ? `Source notes: ${row.source_notes}` : null,
      total === 0 ? 'Source recorded $0 for this shipment.' : null,
      `key=${sourceKey}`,
    ])

    queries.push(sql`
      insert into orders (
        id, customer_id, created_by, order_type, payment_terms, payment_status,
        status, shipping_status, subtotal, tax, total, notes, created_at
      ) values (
        ${orderId}, ${row.account_id}, ${creatorUserId}, 'paid', 'NET30', 'not_applicable',
        'fulfilled', 'delivered', ${money(total)}, '0.00', ${money(total)}, ${notes}, ${createdAt}
      )
    `)
    queries.push(sql`
      insert into order_items (
        id, order_id, product_id, quantity, unit, unit_price, total
      ) values (
        ${itemId}, ${orderId}, ${productId}, ${cases.toFixed(2)}, 'case', ${money(unitPrice)}, ${money(total)}
      )
    `)
    queries.push(sql`
      insert into activity_events (
        id, entity_type, entity_id, actor_user_id, kind, title, body, metadata, created_at
      ) values (
        ${activityId}, 'order', ${orderId}, ${creatorUserId}, 'order_historical_imported',
        'Historical order imported',
        ${`${cases.toFixed(2)} case(s) of ${productName} imported from ${row.source_file}.`},
        ${JSON.stringify({ accountId: row.account_id, importTag: audit.import_tag, sourceFile: row.source_file, sourceSheet: row.source_sheet, sourceRow: row.source_row, sourceKey })}::jsonb,
        ${createdAt}
      )
    `)
    insertedOrderIds.push(orderId)
  }

  for (const row of tastingsToInsert) {
    const tastingId = randomUUID()
    const activityId = randomUUID()
    const reportId = randomUUID()
    const sourceKey = `${audit.import_tag}:tasting:${row.account_id}:${row.date}`
    const notes = compact([
      `Historical ${row.activity_type.toLowerCase()} import [${audit.import_tag}]`,
      `Source: '${row.source_file}', sheet '${row.source_sheet}', row ${row.source_row}`,
      row.source_account !== row.account_name ? `Source location: ${row.source_account}` : null,
      row.source_taster ? `Source taster: ${row.source_taster}` : null,
      row.source_notes,
      `key=${sourceKey}`,
    ])

    queries.push(sql`
      insert into tastings (
        id, customer_id, assigned_user_id, created_by_user_id, event_name,
        scheduled_at, end_at, checked_in_at, status, notes, created_at
      ) values (
        ${tastingId}, ${row.account_id}, ${row.assigned_user_id}, ${creatorUserId}, ${row.account_name.trim()},
        ${row.scheduled_at}, ${row.end_at}, ${row.status === 'completed' ? row.scheduled_at : null}, ${row.status}, ${notes}, ${row.scheduled_at}
      )
    `)

    if (row.status === 'completed') {
      queries.push(sql`
        insert into tasting_reports (
          id, tasting_id, submitted_by_user_id, samples_served, bottles_sold,
          consumer_interactions, bottle_price_on_shelf, bottles_in_stock_before,
          account_feedback, highlights, issues, follow_up_needed, submitted_at
        ) values (
          ${reportId}, ${tastingId}, ${row.assigned_user_id}, ${row.samples_served}, ${row.bottles_sold},
          ${row.consumer_interactions}, ${row.bottle_price_on_shelf}, ${row.bottles_in_stock_before},
          ${row.account_feedback}, ${row.highlights}, ${row.issues}, false, ${row.end_at}
        )
      `)
    }

    queries.push(sql`
      insert into activity_events (
        id, entity_type, entity_id, actor_user_id, related_user_id, kind, title, body, metadata, created_at
      ) values (
        ${activityId}, 'tasting', ${tastingId}, ${creatorUserId}, ${row.assigned_user_id}, 'tasting_historical_imported',
        ${row.status === 'cancelled' ? 'Historical tasting cancellation imported' : 'Historical tasting imported'},
        ${`${row.account_name.trim()} history imported from ${row.source_file}.`},
        ${JSON.stringify({ accountId: row.account_id, importTag: audit.import_tag, sourceFile: row.source_file, sourceSheet: row.source_sheet, sourceRow: row.source_row, sourceKey })}::jsonb,
        ${row.scheduled_at}
      )
    `)
    insertedTastingIds.push(tastingId)
  }

  if (queries.length > 0) {
    await sql.transaction(queries)
  }

  console.log(JSON.stringify({
    ...preflight,
    insertedOrders: insertedOrderIds.length,
    insertedTastings: insertedTastingIds.length,
    insertedTastingReports: tastingsToInsert.filter((row) => row.status === 'completed').length,
    insertedCancelledTastings: tastingsToInsert.filter((row) => row.status === 'cancelled').length,
    insertedActivityEvents: insertedOrderIds.length + insertedTastingIds.length,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
