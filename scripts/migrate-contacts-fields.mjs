import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone_type TEXT`
await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_contact TEXT`

console.log('Migration complete: phone_type and preferred_contact added to contacts')
process.exit(0)
