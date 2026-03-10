import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import bcrypt from 'bcryptjs'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

async function seed() {
  console.log('Seeding database...')

  // Create admin user
  const passwordHash = await bcrypt.hash('admin123', 12)
  const [admin] = await db
    .insert(schema.users)
    .values({
      email: 'admin@ahawc.com',
      passwordHash,
      role: 'admin',
      name: 'AHAWC Admin',
      phone: '555-0100',
    })
    .onConflictDoNothing()
    .returning()

  console.log('Admin user:', admin?.email ?? 'already exists')

  // Seed Chart of Accounts
  const defaultAccounts = [
    { accountNumber: '1000', accountName: 'Cash', type: 'asset' as const },
    { accountNumber: '1100', accountName: 'Accounts Receivable', type: 'asset' as const },
    { accountNumber: '1200', accountName: 'Inventory - Paid Cases', type: 'asset' as const },
    { accountNumber: '1210', accountName: 'Inventory - Sample Cases', type: 'asset' as const },
    { accountNumber: '2000', accountName: 'Accounts Payable', type: 'liability' as const },
    { accountNumber: '3000', accountName: "Owner's Equity", type: 'equity' as const },
    { accountNumber: '4000', accountName: 'Sales Revenue', type: 'revenue' as const },
    { accountNumber: '4100', accountName: 'Sample Revenue', type: 'revenue' as const },
    { accountNumber: '5000', accountName: 'Cost of Goods Sold', type: 'expense' as const },
    { accountNumber: '6000', accountName: 'Operating Expenses', type: 'expense' as const },
  ]

  for (const account of defaultAccounts) {
    await db
      .insert(schema.chartOfAccounts)
      .values(account)
      .onConflictDoNothing()
  }

  console.log('Chart of accounts seeded')
  console.log('Seeding complete!')
}

seed().catch(console.error)
