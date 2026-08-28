import { neon } from '@neondatabase/serverless'

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required.')
  const sql = neon(databaseUrl)
  const tag = 'knowledge-audit-2026-08-27'

  const [orders, tastings, activities, orderDuplicates, tastingDuplicates] = await Promise.all([
    sql`
      select
        count(distinct o.id)::int as orders,
        count(oi.id)::int as order_items,
        count(distinct o.customer_id)::int as accounts,
        coalesce(sum(oi.quantity), 0)::text as cases,
        coalesce(sum(o.total), 0)::text as total,
        min(o.created_at)::text as first_date,
        max(o.created_at)::text as last_date
      from orders o
      inner join order_items oi on oi.order_id = o.id
      where o.notes like ${`%[${tag}]%`}
    `,
    sql`
      select
        count(distinct t.id)::int as tastings,
        count(distinct tr.id)::int as reports,
        count(distinct t.customer_id)::int as accounts,
        count(*) filter (where t.status = 'completed')::int as completed,
        count(*) filter (where t.status = 'cancelled')::int as cancelled,
        min(t.scheduled_at)::text as first_date,
        max(t.scheduled_at)::text as last_date
      from tastings t
      left join tasting_reports tr on tr.tasting_id = t.id
      where t.notes like ${`%[${tag}]%`}
    `,
    sql`
      select entity_type, count(*)::int as count
      from activity_events
      where metadata ->> 'importTag' = ${tag}
      group by entity_type
      order by entity_type
    `,
    sql`
      select o.customer_id, o.created_at::date, oi.quantity, count(*)::int as count
      from orders o
      inner join order_items oi on oi.order_id = o.id
      where o.notes like ${`%[${tag}]%`}
      group by o.customer_id, o.created_at::date, oi.quantity
      having count(*) > 1
    `,
    sql`
      select customer_id, scheduled_at::date, count(*)::int as count
      from tastings
      where notes like ${`%[${tag}]%`}
      group by customer_id, scheduled_at::date
      having count(*) > 1
    `,
  ])

  console.log(JSON.stringify({
    tag,
    orders: orders[0],
    tastings: tastings[0],
    activities,
    duplicateImportedOrderKeys: orderDuplicates.length,
    duplicateImportedTastingKeys: tastingDuplicates.length,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
