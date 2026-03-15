import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

type HealthCheck = {
  label: string
  ok: boolean
  detail: string
}

type SchemaItem = {
  tableName: string
  requiredColumns: string[]
}

type MigrationHistoryState = 'tracked' | 'untracked' | 'missing'

const REQUIRED_SCHEMA: SchemaItem[] = [
  { tableName: 'wholesale_account_requests', requiredColumns: ['id', 'business_name', 'business_email', 'created_at'] },
  { tableName: 'delivery_stops', requiredColumns: ['contact_name', 'contact_phone', 'contact_email', 'proof_of_delivery_url', 'shelf_photo_url'] },
  { tableName: 'orders', requiredColumns: ['shipping_status'] },
  { tableName: 'users', requiredColumns: ['roles', 'avatar_url', 'address', 'city', 'state', 'zip'] },
  { tableName: 'tastings', requiredColumns: ['end_at', 'checked_in_at'] },
  { tableName: 'sms_messages', requiredColumns: ['media_urls'] },
  { tableName: 'user_notifications', requiredColumns: ['available_at'] },
  { tableName: 'activity_events', requiredColumns: ['entity_type', 'entity_id', 'kind'] },
  { tableName: 'sms_threads', requiredColumns: ['phone_number', 'status', 'priority'] },
  { tableName: 'reply_templates', requiredColumns: ['title', 'body', 'category'] },
]

export async function getSystemHealthSnapshot() {
  const appVersion = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
    ?? process.env.NEXT_PUBLIC_APP_VERSION
    ?? 'local'
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID ?? 'local'

  const envChecks: HealthCheck[] = [
    {
      label: 'Telnyx',
      ok: Boolean(process.env.TELNYX_API_KEY && process.env.TELNYX_FROM_NUMBER),
      detail: process.env.TELNYX_API_KEY && process.env.TELNYX_FROM_NUMBER ? 'Configured' : 'Missing key or from number',
    },
    {
      label: 'GCS',
      ok: Boolean(process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_CLIENT_EMAIL && process.env.GOOGLE_CLOUD_PRIVATE_KEY && process.env.GCS_BUCKET_NAME),
      detail: process.env.GCS_BUCKET_NAME ? `Bucket ${process.env.GCS_BUCKET_NAME}` : 'Missing bucket or service-account settings',
    },
    {
      label: 'HubSpot',
      ok: Boolean(process.env.HUBSPOT_API_KEY),
      detail: process.env.HUBSPOT_API_KEY ? 'Configured' : 'Missing API key',
    },
  ]

  const migrationsDir = path.join(process.cwd(), 'db', 'migrations')
  const journalPath = path.join(migrationsDir, 'meta', '_journal.json')
  const journal = JSON.parse(await fs.readFile(journalPath, 'utf8')) as {
    entries: Array<{ tag: string; when: number }>
  }
  const expectedMigrationEntries = await Promise.all(journal.entries.map(async (entry) => {
    const migrationSql = await fs.readFile(path.join(migrationsDir, `${entry.tag}.sql`), 'utf8')
    return {
      tag: entry.tag,
      when: entry.when,
      hash: crypto.createHash('sha256').update(migrationSql).digest('hex'),
    }
  }))
  const expectedMigrations = expectedMigrationEntries.map((entry) => entry.tag)
  let appliedMigrations: string[] = []
  let migrationHistoryState: MigrationHistoryState = 'missing'

  try {
    const migrationTableColumnsRows = await db.execute(sql`
      select column_name
      from information_schema.columns
      where table_schema = 'drizzle'
        and table_name = '__drizzle_migrations'
    `)

    const migrationTableColumns = new Set(
      (migrationTableColumnsRows.rows ?? []).map((row) => String((row as { column_name: string }).column_name))
    )

    if (migrationTableColumns.size === 0) {
      migrationHistoryState = 'missing'
    } else if (migrationTableColumns.has('name')) {
      const migrationRows = await db.execute(sql`
        select coalesce(string_agg(name::text, ',' order by created_at), '') as names
        from (
          select name, created_at
          from "drizzle"."__drizzle_migrations"
        ) migration_rows
      `)
      const value = (migrationRows.rows?.[0] as { names?: string } | undefined)?.names ?? ''
      appliedMigrations = value ? value.split(',').filter(Boolean) : []
      migrationHistoryState = appliedMigrations.length > 0 ? 'tracked' : 'missing'
    } else if (migrationTableColumns.has('hash') && migrationTableColumns.has('created_at')) {
      const migrationRows = await db.execute(sql`
        select hash, created_at
        from "drizzle"."__drizzle_migrations"
      `)
      const appliedKeys = new Set(
        (migrationRows.rows ?? []).map((row) => {
          const typedRow = row as { hash?: string; created_at?: string | number | null }
          return `${String(typedRow.hash ?? '')}:${String(typedRow.created_at ?? '')}`
        }),
      )
      appliedMigrations = expectedMigrationEntries
        .filter((entry) => appliedKeys.has(`${entry.hash}:${entry.when}`))
        .map((entry) => entry.tag)
      migrationHistoryState = migrationRows.rows?.length ? 'tracked' : 'missing'
    } else {
      migrationHistoryState = 'missing'
    }
  } catch {
    appliedMigrations = []
    migrationHistoryState = 'missing'
  }

  const existingTablesRows = await db.execute(sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
  `)
  const existingTables = new Set(
    (existingTablesRows.rows ?? []).map((row) => String((row as { table_name: string }).table_name))
  )

  const columnsRows = await db.execute(sql`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
  `)
  const columnsByTable = new Map<string, Set<string>>()
  for (const row of columnsRows.rows ?? []) {
    const tableName = String((row as { table_name: string }).table_name)
    const columnName = String((row as { column_name: string }).column_name)
    if (!columnsByTable.has(tableName)) columnsByTable.set(tableName, new Set())
    columnsByTable.get(tableName)?.add(columnName)
  }

  const missingTables: string[] = []
  const missingColumns: Array<{ tableName: string; columnName: string }> = []
  for (const item of REQUIRED_SCHEMA) {
    if (!existingTables.has(item.tableName)) {
      missingTables.push(item.tableName)
      continue
    }
    const tableColumns = columnsByTable.get(item.tableName) ?? new Set<string>()
    for (const column of item.requiredColumns) {
      if (!tableColumns.has(column)) {
        missingColumns.push({ tableName: item.tableName, columnName: column })
      }
    }
  }

  const hasCoreSchemaObjects = existingTables.has('users')
    && existingTables.has('orders')
    && existingTables.has('delivery_stops')
    && existingTables.has('wholesale_account_requests')
    && existingTables.has('sms_messages')

  if (migrationHistoryState === 'missing' && hasCoreSchemaObjects) {
    migrationHistoryState = 'untracked'
  }

  const pendingMigrations = migrationHistoryState === 'tracked'
    ? expectedMigrations.filter((entry) => !appliedMigrations.includes(entry))
    : []

  return {
    appVersion,
    deploymentId,
    expectedMigrations,
    appliedMigrations,
    migrationHistoryState,
    pendingMigrations,
    missingTables,
    missingColumns,
    envChecks,
  }
}
