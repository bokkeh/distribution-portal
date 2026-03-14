import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

const SUPER_ADMIN_EMAIL = 'alex@ahawc.com'

async function ensureSuperAdmin() {
  console.log(`Ensuring ${SUPER_ADMIN_EMAIL} is set up as super admin...`)

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, SUPER_ADMIN_EMAIL))
    .limit(1)

  if (existing) {
    const updated = await db
      .update(schema.users)
      .set({
        role: 'admin',
        roles: ['admin'],
        active: true,
        name: existing.name || 'Alex',
      })
      .where(eq(schema.users.email, SUPER_ADMIN_EMAIL))
      .returning()

    console.log(`Updated existing user: ${updated[0].email} — role=${updated[0].role}, active=${updated[0].active}`)
  } else {
    const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12)
    const [created] = await db
      .insert(schema.users)
      .values({
        email: SUPER_ADMIN_EMAIL,
        passwordHash,
        role: 'admin',
        roles: ['admin'],
        name: 'Alex',
        active: true,
      })
      .returning()

    console.log(`Created new user: ${created.email} — role=${created.role}, active=${created.active}`)
  }

  console.log('Done.')
}

ensureSuperAdmin().catch(console.error)
