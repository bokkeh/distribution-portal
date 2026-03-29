import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { activityEvents, geographicPricingRules, products, users } from '@/db/schema'
import { requireRole } from '@/lib/auth/session'
import { GeographicPricingManager } from '@/components/pricing/GeographicPricingManager'

function isMissingGeographicPricingTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return (
    (message.includes('geographic_pricing_rules') && message.includes('does not exist')) ||
    (message.includes('customer_accounts') && message.includes('county') && message.includes('does not exist')) ||
    (message.includes('order_items') && message.includes('pricing_') && message.includes('does not exist'))
  )
}

async function hasGeographicPricingSchema() {
  const tablesRows = await db.execute(sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('geographic_pricing_rules')
  `)

  const columnsRows = await db.execute(sql`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'customer_accounts' and column_name in ('county'))
        or
        (table_name = 'order_items' and column_name in ('pricing_source', 'pricing_rule_id', 'pricing_state', 'pricing_county'))
        or
        (table_name = 'geographic_pricing_rules' and column_name in ('product_id', 'state_code', 'county_name', 'county_key', 'rule_type', 'min_case_quantity', 'max_case_quantity', 'case_price', 'effective_start_date', 'effective_end_date', 'is_active', 'updated_by', 'updated_at'))
      )
  `)

  const existingTables = new Set(
    (tablesRows.rows ?? []).map((row) => String((row as { table_name: string }).table_name))
  )

  const columnsByTable = new Map<string, Set<string>>()
  for (const row of columnsRows.rows ?? []) {
    const tableName = String((row as { table_name: string }).table_name)
    const columnName = String((row as { column_name: string }).column_name)
    if (!columnsByTable.has(tableName)) columnsByTable.set(tableName, new Set())
    columnsByTable.get(tableName)?.add(columnName)
  }

  if (!existingTables.has('geographic_pricing_rules')) return false

  const requiredColumns: Record<string, string[]> = {
    customer_accounts: ['county'],
    order_items: ['pricing_source', 'pricing_rule_id', 'pricing_state', 'pricing_county'],
    geographic_pricing_rules: ['product_id', 'state_code', 'county_name', 'county_key', 'rule_type', 'min_case_quantity', 'max_case_quantity', 'case_price', 'effective_start_date', 'effective_end_date', 'is_active', 'updated_by', 'updated_at'],
  }

  for (const [tableName, required] of Object.entries(requiredColumns)) {
    const available = columnsByTable.get(tableName) ?? new Set<string>()
    for (const column of required) {
      if (!available.has(column)) return false
    }
  }

  return true
}

export default async function GeographicPricingPage() {
  await requireRole('admin')

  let missingMigration = false
  let productRows: Array<{ id: string; sku: string; name: string }> = []
  let ruleRows: Array<{
    id: string
    productId: string
    productName: string | null
    productSku: string | null
    stateCode: string
    countyName: string | null
    ruleType: 'state' | 'county'
    minCaseQuantity: number | null
    maxCaseQuantity: number | null
    casePrice: string
    effectiveStartDate: string | Date
    effectiveEndDate: string | Date | null
    isActive: boolean
    notes: string | null
    updatedAt: string | Date
    updatedByName: string | null
  }> = []
  let historyRows: Array<{
    id: string
    entityId: string
    title: string
    body: string | null
    createdAt: string | Date
    actorName: string | null
  }> = []

  const schemaReady = await hasGeographicPricingSchema()
  if (!schemaReady) {
    missingMigration = true
  }

  if (schemaReady) try {
    ;[productRows, ruleRows, historyRows] = await Promise.all([
      db
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
        })
        .from(products)
        .where(eq(products.active, true))
        .orderBy(products.name),
      db
        .select({
          id: geographicPricingRules.id,
          productId: geographicPricingRules.productId,
          productName: products.name,
          productSku: products.sku,
          stateCode: geographicPricingRules.stateCode,
          countyName: geographicPricingRules.countyName,
          ruleType: geographicPricingRules.ruleType,
          minCaseQuantity: geographicPricingRules.minCaseQuantity,
          maxCaseQuantity: geographicPricingRules.maxCaseQuantity,
          casePrice: geographicPricingRules.casePrice,
          effectiveStartDate: geographicPricingRules.effectiveStartDate,
          effectiveEndDate: geographicPricingRules.effectiveEndDate,
          isActive: geographicPricingRules.isActive,
          notes: geographicPricingRules.notes,
          updatedAt: geographicPricingRules.updatedAt,
          updatedByName: users.name,
        })
        .from(geographicPricingRules)
        .leftJoin(products, eq(geographicPricingRules.productId, products.id))
        .leftJoin(users, eq(geographicPricingRules.updatedBy, users.id))
        .orderBy(desc(geographicPricingRules.updatedAt)),
      db
        .select({
          id: activityEvents.id,
          entityId: activityEvents.entityId,
          title: activityEvents.title,
          body: activityEvents.body,
          createdAt: activityEvents.createdAt,
          actorName: users.name,
        })
        .from(activityEvents)
        .leftJoin(users, eq(activityEvents.actorUserId, users.id))
        .where(eq(activityEvents.entityType, 'pricing_rule'))
        .orderBy(desc(activityEvents.createdAt))
        .limit(50),
    ])

  } catch (error) {
    if (!isMissingGeographicPricingTable(error)) {
      throw error
    }
    missingMigration = true
  }

  if (missingMigration) {
    return (
      <div className="space-y-6 p-4 sm:p-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Geographic Pricing</h1>
          <p className="mt-1 text-muted-foreground">
            Geographic pricing is not available yet in this database.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="font-semibold text-amber-900">Migration required</p>
          <p className="mt-2 text-sm text-amber-800">
            The geographic pricing tables and columns have not been applied yet. Run the database migrations for
            `0031_geographic_pricing.sql` and `0032_geographic_pricing_quantity_tiers.sql`, then reload this page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Geographic Pricing</h1>
        <p className="mt-1 text-muted-foreground">
          Manage state-level pricing, county overrides, effective dating, and pricing audit history.
        </p>
      </div>
      <GeographicPricingManager products={productRows} rules={ruleRows} history={historyRows} />
    </div>
  )
}
