import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import { db } from './index'

type JournalEntry = {
  idx: number
  when: number
  tag: string
  breakpoints: boolean
}

async function run() {
  const migrationsDir = path.join(process.cwd(), 'db', 'migrations')
  const journalPath = path.join(migrationsDir, 'meta', '_journal.json')
  const journal = JSON.parse(await fs.readFile(journalPath, 'utf8')) as {
    entries: JournalEntry[]
  }

  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle";`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      "id" serial PRIMARY KEY,
      "hash" text NOT NULL,
      "created_at" bigint
    );
  `)

  const existingRows = await db.execute(sql`
    SELECT "hash", "created_at"
    FROM "drizzle"."__drizzle_migrations"
  `)

  const existingKeys = new Set(
    (existingRows.rows ?? []).map((row) => {
      const typedRow = row as { hash?: string; created_at?: string | number | null }
      return `${String(typedRow.hash ?? '')}:${String(typedRow.created_at ?? '')}`
    }),
  )

  for (const entry of journal.entries) {
    const migrationPath = path.join(migrationsDir, `${entry.tag}.sql`)
    const migrationSql = await fs.readFile(migrationPath, 'utf8')
    const hash = crypto.createHash('sha256').update(migrationSql).digest('hex')
    const key = `${hash}:${entry.when}`

    if (existingKeys.has(key)) {
      continue
    }

    await db.execute(sql`
      INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
      VALUES (${hash}, ${entry.when})
    `)

    existingKeys.add(key)
  }

  console.log(`Drizzle migration history repaired with ${journal.entries.length} journal entries.`)
}

run().catch((error) => {
  console.error('Migration history repair failed:', error)
  process.exit(1)
})
