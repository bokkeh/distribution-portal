/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS esbuild boundary harness. */
const path = require('node:path')
const fs = require('node:fs/promises')
const { build } = require('esbuild')
const { PGlite } = require('@electric-sql/pglite')
const { drizzle } = require('drizzle-orm/pglite')
const { is, SQL } = require('drizzle-orm')
const { PgTable, PgDialect, getTableConfig } = require('drizzle-orm/pg-core')

async function createHarness() {
  const runtime = {
    paths: [], after: [],
    session: { user: { id: '10000000-0000-4000-8000-000000000001', name: 'Operator', role: 'admin', roles: ['admin'] } },
  }
  global.__operatorTest = runtime
  const stubs = {
    '@/db': 'export const db = new Proxy({}, { get: (_, key) => { const db = globalThis.__operatorTest.db; const value = db[key]; return typeof value === "function" ? value.bind(db) : value } })',
    '@/lib/auth/session': `export async function requireRole(...roles) { const s = globalThis.__operatorTest.session; if (!s.user.roles.includes('admin') && !roles.some(r => s.user.roles.includes(r))) throw new Error('Unauthorized'); return s } export const requireAdminOrStaff = () => requireRole('admin','staff'); export const requireAdmin = () => requireRole('admin'); export const requireFeature = (feature,...roles) => requireRole(...roles); export const getEffectiveSession = () => requireRole('admin','staff'); export const requireAuth = () => globalThis.__operatorTest.session;`,
    'next/cache': 'export const revalidatePath = path => globalThis.__operatorTest.paths.push(path)',
    'next/server': 'export const after = callback => globalThis.__operatorTest.after.push(callback)',
    'next/navigation': `export function redirect(url) { throw Object.assign(new Error('redirect'), { url }) }`,
    'next/headers': 'export async function headers() { return new Headers() }',
    '@/lib/tastings/calendar-sync': 'export function queueTastingCalendarSync() {}',
    '@/lib/tastings/sms-series': 'export async function clearScheduledTastingSmsJobs() {} export function formatTastingSmsPayload(v) { return v } export async function queueScheduledTastingSmsJobs() {} export async function sendTastingSmsFromTemplate() {}',
    '@/lib/notifications/dispatch': 'export async function notify() { throw new Error("Test notification outage") }',
    '@/lib/notifications/in-app': 'export async function createUserNotification() {} export async function clearUserNotifications() {} export async function createNotificationsForRoles() {}',
    '@/lib/notifications/recipients': 'export async function getStaffEmailsForNotification() { return [] }',
    '@/lib/activity/log': 'export async function logActivityEvent() {}',
    '@/lib/resend/client': 'export async function sendInternalAlertEmail() {} export async function sendTasterInvoiceNotification() {} export async function sendFieldInvoiceEmail() { globalThis.__operatorTest.emailCalls = (globalThis.__operatorTest.emailCalls ?? 0) + 1; return globalThis.__operatorTest.emailSuccess ?? false }',
    '@/lib/telnyx/client': 'export async function sendSms() {}',
    '@/lib/google-chat/webhook': 'export async function postGoogleChat() {}',
    '@/lib/gcs/photo-url': 'export async function signedPhotoUrl(v) { return v }',
    '@/lib/preferences/read': 'export async function getUserPreferences() { return { smsNotificationsEnabled: true, emailNotificationsEnabled: true, inAppNotificationsEnabled: true } }',
    '@/lib/auth/rate-limit': 'export async function isCommunitySignupRateLimited() { return false }',
    '@/actions/invoices': 'export async function createPublicPaymentIntent() { return { clientSecret: \"test-secret\", amount: \"103.30\", processingFee: \"3.30\" } }',
    'server-only': '',
  }
  const outfile = path.resolve(`tmp/operator-tests/server-${process.pid}.cjs`)
  await build({ entryPoints: ['tests/fixtures/operator-entry.ts'], bundle: true, platform: 'node', format: 'cjs', packages: 'external', outfile,
    plugins: [{ name: 'isolated-boundaries', setup(b) {
      b.onResolve({ filter: /.*/ }, args => Object.hasOwn(stubs, args.path) ? { path: args.path, namespace: 'test' } : undefined)
      b.onLoad({ filter: /.*/, namespace: 'test' }, args => ({ contents: stubs[args.path], loader: 'js' }))
    } }],
  })
  delete require.cache[outfile]
  const api = require(outfile)
  const pg = new PGlite()
  runtime.db = drizzle(pg, { schema: api.schema })
  const tables = Object.values(api.schema).filter(table => is(table, PgTable) && getTableConfig(table).name !== 'field_documents')
  const dialect = new PgDialect()
  const quote = value => `"${value.replaceAll('"', '""')}"`
  const literal = value => value == null ? 'NULL' : typeof value === 'boolean' ? String(value) : typeof value === 'number' ? String(value) : `'${(typeof value === 'object' ? JSON.stringify(value) : String(value)).replaceAll("'", "''")}'`
  const newColumns = { tastings: ['time_zone', 'scheduling_fingerprint'], contacts: ['relationship_status'], customer_accounts: ['scheduling_venue_key'], account_price_history: ['observed_at', 'time_zone', 'currency', 'price_type', 'product_size'] }
  for (const table of tables) {
    const config = getTableConfig(table)
    const columns = config.columns.filter(col => !(newColumns[config.name] ?? []).includes(col.name)).map(col => {
      let defaultSql = ''
      if (col.default !== undefined) {
        if (is(col.default, SQL)) {
          const query = dialect.sqlToQuery(col.default)
          defaultSql = query.sql.replace(/\$(\d+)/g, (_, n) => literal(query.params[Number(n) - 1]))
        } else defaultSql = col.getSQLType().endsWith('[]') && Array.isArray(col.default)
          ? `ARRAY[${col.default.map(literal).join(',')}]::${col.getSQLType()}` : literal(col.default)
      }
      const historicallyRequired = (config.name === 'tastings' && col.name === 'assigned_user_id') || (config.name === 'contacts' && col.name === 'customer_id')
      return `${quote(col.name)} ${col.getSQLType()}${col.primary ? ' PRIMARY KEY' : ''}${col.notNull || historicallyRequired ? ' NOT NULL' : ''}${col.isUnique ? ' UNIQUE' : ''}${defaultSql ? ` DEFAULT ${defaultSql}` : ''}`
    })
    for (const unique of config.uniqueConstraints) columns.push(`CONSTRAINT ${quote(unique.getName())} UNIQUE (${unique.columns.map(col => quote(col.name)).join(',')})`)
    for (const index of config.indexes.filter(index => index.config.unique)) {
      const cols = index.config.columns.map(col => quote(col.name))
      columns.push(`UNIQUE (${cols.join(',')})`)
    }
    await pg.exec(`CREATE TABLE ${quote(config.name)} (${columns.join(',')})`)
  }
  for (const table of tables) {
    const config = getTableConfig(table)
    for (const fk of config.foreignKeys) {
      const ref = fk.reference()
      await pg.exec(`ALTER TABLE ${quote(config.name)} ADD CONSTRAINT ${quote(fk.getName())} FOREIGN KEY (${ref.columns.map(col => quote(col.name)).join(',')}) REFERENCES ${quote(getTableConfig(ref.foreignTable).name)} (${ref.foreignColumns.map(col => quote(col.name)).join(',')}) ON DELETE ${fk.onDelete ?? 'no action'}`)
    }
  }
  // Seed historical rows before migration, including the original manual FK name.
  await pg.exec(`ALTER TABLE tastings RENAME CONSTRAINT tastings_assigned_user_id_users_id_fk TO tastings_assigned_user_id_fkey`)
  await pg.exec(`INSERT INTO users (id,name,email,password_hash,role,roles) VALUES ('90000000-0000-4000-8000-000000000001','Historical member','history@example.test','test','taster',ARRAY['taster'])`)
  await pg.exec(`INSERT INTO customer_accounts (id,company_name) VALUES ('90000000-0000-4000-8000-000000000002','Historical venue')`)
  await pg.exec(`INSERT INTO products (id,name,sku,unit,price) VALUES ('90000000-0000-4000-8000-000000000003','Historical product','LEGACY','case',100)`)
  await pg.exec(`INSERT INTO tastings (id,event_name,customer_id,assigned_user_id,created_by_user_id,scheduled_at,status) VALUES ('90000000-0000-4000-8000-000000000004','Historical tasting','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','2025-10-17T20:00:00Z','completed')`)
  await pg.exec(`INSERT INTO contacts (id,customer_id,name) VALUES ('90000000-0000-4000-8000-000000000005','90000000-0000-4000-8000-000000000002','Historical contact')`)
  await pg.exec(`INSERT INTO account_price_history (id,account_id,product_id,price,observed_on) VALUES ('90000000-0000-4000-8000-000000000006','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003',23.99,'2025-10-17')`)
  // Apply the actual migration against the pre-change nullability and columns.
  await pg.exec(await fs.readFile('db/migrations/0080_operator_workflows.sql', 'utf8'))
  await pg.exec(await fs.readFile('db/migrations/0081_field_documents.sql', 'utf8'))
  runtime.db.batch = queries => pg.transaction(async tx => { const results = []; for (const query of queries) { const compiled = query.toSQL(); results.push(await tx.query(compiled.sql, compiled.params)) } return results })
  const { users, customerAccounts, products } = api.schema
  await runtime.db.insert(users).values([
    { id: runtime.session.user.id, name: 'Operator', email: 'operator@example.test', passwordHash: 'test', role: 'admin', roles: ['admin'] },
    { id: '10000000-0000-4000-8000-000000000002', name: 'Rachel', email: 'rachel@example.test', passwordHash: 'test', role: 'taster', roles: ['taster'] },
  ])
  await runtime.db.insert(customerAccounts).values({ id: '20000000-0000-4000-8000-000000000001', companyName: 'Test Venue', city: 'Ellicott City', state: 'MD' })
  await runtime.db.insert(products).values({ id: '30000000-0000-4000-8000-000000000001', name: 'Test Vodka', sku: 'TEST-750', unit: 'case', price: '100', bottlePrice: '20', bottlesPerCase: 6 })
  return { api, runtime, pg, accountId: '20000000-0000-4000-8000-000000000001', productId: '30000000-0000-4000-8000-000000000001', rachelId: '10000000-0000-4000-8000-000000000002' }
}
module.exports = { createHarness }
