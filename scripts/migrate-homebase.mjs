import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

await sql`ALTER TABLE sales_routes ADD COLUMN IF NOT EXISTS origin_address TEXT`
await sql`ALTER TABLE sales_routes ADD COLUMN IF NOT EXISTS origin_lat NUMERIC(10,7)`
await sql`ALTER TABLE sales_routes ADD COLUMN IF NOT EXISTS origin_lng NUMERIC(10,7)`

await sql`ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS origin_address TEXT`
await sql`ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS origin_lat NUMERIC(10,7)`
await sql`ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS origin_lng NUMERIC(10,7)`

console.log('Migration complete: origin address columns added to sales_routes and deliveries')
process.exit(0)
