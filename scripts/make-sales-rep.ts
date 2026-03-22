/**
 * One-time script: creates a salesMembers record for alex@ahawc.com
 * and adds sales_rep to their roles array.
 *
 * Run: npx tsx scripts/make-sales-rep.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

const TARGET_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? 'alex@ahawc.com'

async function run() {
  // 1. Find user
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, TARGET_EMAIL))
    .limit(1)

  if (!user) {
    console.error(`No user found with email: ${TARGET_EMAIL}`)
    process.exit(1)
  }

  console.log(`Found user: ${user.name} (${user.email})`)

  // 2. Add sales_rep role if not already present
  const roles = user.roles ?? [user.role]
  if (!roles.includes('sales_rep')) {
    const updatedRoles = [...roles, 'sales_rep']
    await db
      .update(schema.users)
      .set({ roles: updatedRoles })
      .where(eq(schema.users.id, user.id))
    console.log(`Updated roles: ${updatedRoles.join(', ')}`)
  } else {
    console.log('Already has sales_rep role')
  }

  // 3. Create salesMembers record if not exists
  const [existing] = await db
    .select()
    .from(schema.salesMembers)
    .where(eq(schema.salesMembers.userId, user.id))
    .limit(1)

  if (existing) {
    console.log('Sales member record already exists:', existing.id)
  } else {
    const [created] = await db
      .insert(schema.salesMembers)
      .values({
        userId: user.id,
        status: 'active',
        onboardingStatus: 'complete',
        hireDate: new Date().toISOString().slice(0, 10),
        notes: 'Auto-created for portal testing',
      })
      .returning()

    console.log('Created sales member record:', created.id)
  }

  console.log('Done! Sign out and back in to pick up the new role.')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
