import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

await sql`ALTER TABLE delivery_stops ALTER COLUMN customer_id DROP NOT NULL`
await sql`ALTER TABLE sales_route_stops ALTER COLUMN customer_id DROP NOT NULL`

console.log('Migration complete: customer_id is now nullable on delivery_stops and sales_route_stops')
process.exit(0)
