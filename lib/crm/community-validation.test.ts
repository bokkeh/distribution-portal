import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { adminCommunityPersonSchema } from './community-validation'

test('admin members can have email only, phone only, or neither', () => {
  for (const details of [{ email: 'person@example.com' }, { phone: '5551234567' }, {}, { email: '  ', phone: '  ' }]) {
    const person = adminCommunityPersonSchema.parse({ firstName: 'Sam', lastName: 'Member', ...details })
    assert.equal(typeof person.email, 'string')
    assert.equal(typeof person.phone, 'string')
  }
  assert.equal(adminCommunityPersonSchema.parse({ firstName: 'Sam', lastName: 'Member', email: ' SAM@EXAMPLE.COM ' }).email, 'sam@example.com')
})

test('supplied invalid contact details are still rejected', () => {
  for (const details of [{ email: 'bad-email' }, { phone: '123' }]) {
    assert.equal(adminCommunityPersonSchema.safeParse({ firstName: 'Sam', lastName: 'Member', ...details }).success, false)
  }
})

test('migration allows multiple missing emails while retaining real-email upserts', async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE TABLE community_contacts (id serial PRIMARY KEY, email text NOT NULL, phone text NOT NULL); CREATE UNIQUE INDEX community_contacts_email_uidx ON community_contacts(email);')
    await db.exec(await readFile('db/migrations/0084_optional_community_contact_details.sql', 'utf8'))
    await db.exec("INSERT INTO community_contacts(email,phone) VALUES ('','5551234567'),('','5559876543'),('','');")
    const result = await db.query<{ count: number }>('SELECT count(*)::int as count FROM community_contacts')
    assert.equal(result.rows[0].count, 3)
    await db.exec("INSERT INTO community_contacts(email,phone) VALUES ('sam@example.com','first') ON CONFLICT(email) WHERE email <> '' DO UPDATE SET phone=excluded.phone;")
    await db.exec("INSERT INTO community_contacts(email,phone) VALUES ('sam@example.com','updated') ON CONFLICT(email) WHERE email <> '' DO UPDATE SET phone=excluded.phone;")
    const updated = await db.query<{ phone: string }>("SELECT phone FROM community_contacts WHERE email='sam@example.com'")
    assert.deepEqual(updated.rows, [{ phone: 'updated' }])
  } finally {
    await db.close()
  }
})
