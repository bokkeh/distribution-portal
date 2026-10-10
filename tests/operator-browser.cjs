/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression runner. */
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const http = require('node:http')
const path = require('node:path')
const { build } = require('esbuild')
const { createHarness } = require('./operator-harness.cjs')

async function main() {
  // Prefer the project's dev dependency, allowing the supplied runtime for local verification.
  const { chromium, webkit } = require(process.env.OPERATOR_PLAYWRIGHT_PATH || 'playwright')
  const h = await createHarness()
  const stubs = {
    '@/actions/quick-schedule-tasting': `export async function quickScheduleTasting(input) { const response = await fetch('/schedule', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }); return response.json() }`,
    '@/actions/tastings': 'export async function deleteTasting() {} export async function reassignTasting() {} export async function updateTastingStatus() {}',
    'next/navigation': 'export function useRouter() { return { refresh: () => window.operatorRefresh(), push: () => {} } }',
    'next/link': `import React from 'react'; export default function Link({children,...props}) { return React.createElement('a',props,children) }`,
  }
  await build({ entryPoints: ['tests/fixtures/operator-browser.jsx'], bundle: true, platform: 'browser', format: 'iife', outfile: 'tmp/operator-tests/client.js', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY': '"test-key"' }, plugins: [{ name: 'test-client-boundaries', setup(b) {
    b.onResolve({ filter: /.*/ }, args => Object.hasOwn(stubs, args.path) ? { path: args.path, namespace: 'test' } : undefined)
    b.onLoad({ filter: /.*/, namespace: 'test' }, args => ({ contents: stubs[args.path], loader: 'jsx', resolveDir: process.cwd() }))
  } }] })
  const postcss = require('postcss')
  const tailwind = require('@tailwindcss/postcss')
  const css = (await postcss([tailwind()]).process((await fs.readFile('app/globals.css', 'utf8')) + '\n@source "../components"; @source "../tests/fixtures";', { from: path.resolve('app/globals.css') })).css
  let failNext = false
  let saveCalls = 0
  const server = http.createServer(async (request, response) => {
    try {
      response.setHeader('content-type', 'application/json')
      if (request.url === '/client.js') { response.setHeader('content-type', 'application/javascript'); return response.end(await fs.readFile('tmp/operator-tests/client.js')) }
      if (request.url === '/styles.css') { response.setHeader('content-type', 'text/css'); return response.end(css) }
      if (request.url === '/state') {
        const accounts = await h.runtime.db.select().from(h.api.schema.customerAccounts)
        return response.end(JSON.stringify({ accounts, members: [{ id: h.rachelId, name: 'Rachel', phone: null }], tastings: await h.api.getTastingsForViewWithFallback({}) }))
      }
      if (request.url === '/schedule') {
        saveCalls += 1
        const chunks = []; for await (const chunk of request) chunks.push(chunk)
        const input = JSON.parse(Buffer.concat(chunks).toString())
        await new Promise(resolve => setTimeout(resolve, 250))
        if (failNext) { failNext = false; return response.end(JSON.stringify({ error: 'Test connection failure. Your details are kept; retry.' })) }
        return response.end(JSON.stringify(await h.api.quickScheduleTasting(input)))
      }
      response.setHeader('content-type', 'text/html')
      return response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/client.js"></script></body></html>')
    } catch (error) { response.statusCode = 500; response.end(JSON.stringify({ error: error.message })) }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}`
  let browser
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true })
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, hasTouch: viewport.width < 500, isMobile: viewport.width < 500 })
      await context.addInitScript(() => {
        window.google = { maps: { places: {
          AutocompleteService: class { getPlacePredictions({ input }, callback) { setTimeout(() => callback([{ description: '123 Main Street, Test City, MD', place_id: 'main' }]), input.startsWith('Slow') ? 900 : 30) } },
          PlacesService: class { getDetails(_, callback) { setTimeout(() => callback({ address_components: [
            { types: ['street_number'], long_name: '123', short_name: '123' }, { types: ['route'], long_name: 'Main Street', short_name: 'Main St' },
            { types: ['locality'], long_name: 'Test City', short_name: 'Test City' }, { types: ['administrative_area_level_1'], long_name: 'Maryland', short_name: 'MD' }, { types: ['postal_code'], long_name: '21043', short_name: '21043' },
          ] }), 20) } },
        } } }
      })
      const page = await context.newPage()
      const errors = []; page.on('pageerror', error => errors.push(error.message))
      await page.goto(url)
      const form = page.locator('#quick-schedule-tasting form')
      await form.getByLabel('Account / venue').selectOption(h.accountId)
      await form.getByText('Contact and notes (optional)', { exact: true }).click()
      await form.getByLabel('Venue contact').fill('Manager at counter')
      await form.getByLabel('Notes', { exact: true }).fill('Keep this note after failure')
      failNext = true
      await form.getByRole('button', { name: 'Schedule tasting', exact: true }).click()
      await page.getByRole('alert').waitFor()
      assert.equal(await form.getByLabel('Venue contact').inputValue(), 'Manager at counter')
      assert.equal(await form.getByLabel('Notes', { exact: true }).inputValue(), 'Keep this note after failure')
      assert.equal(await page.getByText('Tasting saved', { exact: true }).count(), 0)
      const before = saveCalls
      // Fire repeated submit events in the same tick to exercise the synchronous single-flight guard.
      await form.evaluate(form => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
      await page.getByText('Tasting saved', { exact: true }).waitFor()
      assert.equal(saveCalls - before, 1)
      await page.getByRole('tabpanel').getByText('Test Venue', { exact: true }).first().waitFor()
      assert.ok(await page.getByRole('status').getByText(/Unassigned/).count())
      await page.getByRole('button', { name: 'Schedule next tasting' }).click()
      assert.equal(await form.isVisible(), true)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No horizontal overflow at ${viewport.width}`)

      const addressForm = page.getByRole('form', { name: 'Address regression' })
      const address = addressForm.getByLabel('Street address')
      await address.focus(); await address.fill('123 Main')
      const suggestion = page.getByRole('option').getByRole('button')
      await suggestion.waitFor()
      if (viewport.width < 500) await suggestion.tap(); else await suggestion.click()
      await page.waitForFunction(() => document.getElementById('address').value === '123 Main St')
      assert.equal(await page.getByRole('listbox').count(), 0)
      assert.equal(await addressForm.getByLabel('City', { exact: true }).inputValue(), 'Test City')
      await address.fill('123 other'); await suggestion.waitFor(); await address.press('Escape')
      assert.equal(await page.getByRole('listbox').count(), 0)
      await address.fill('123 keyboard'); await suggestion.waitFor(); await address.press('ArrowDown'); await address.press('Enter')
      await page.waitForFunction(() => document.getElementById('address').value === '123 Main St')
      assert.equal(await page.getByRole('listbox').count(), 0)
      await address.fill('123 outside'); await suggestion.waitFor(); await addressForm.getByRole('button', { name: 'Next field' }).click()
      assert.equal(await page.getByRole('listbox').count(), 0)
      await address.fill('Slow address'); await addressForm.getByRole('button', { name: 'Next field' }).click()
      await page.waitForTimeout(1200)
      assert.equal(await page.getByRole('listbox').count(), 0, 'Late predictions cannot reopen a dismissed list')
      await address.fill('Manual address with no lookup')
      assert.equal(await address.inputValue(), 'Manual address with no lookup')
      assert.deepEqual(errors, [])
      await page.screenshot({ path: `tmp/operator-tests/verified-${viewport.width}.png`, fullPage: true })
      console.log(`PASS Chromium ${viewport.width}px: database save → upcoming refresh, failed-save retention, repeated taps, next booking, address touch/keyboard/dismissal/manual entry`)
      await context.close()
    }
    try {
      const safari = await webkit.launch({ headless: true })
      await safari.close()
      console.log('WebKit available; dedicated Safari verification still requires a device.')
    } catch { console.log('LIMIT: WebKit browser runtime unavailable; physical iPhone Safari not tested.') }
  } finally {
    await browser?.close(); await new Promise(resolve => server.close(resolve)); await h.pg.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
