/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser verification with synthetic metrics. */
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const http = require('node:http')
const path = require('node:path')
const { build } = require('esbuild')
async function main() {
  const output = 'tmp/operator-tests/recipe-engagement-client.js'
  await build({ entryPoints: ['tests/fixtures/recipe-engagement-browser.jsx'], bundle: true, platform: 'browser', format: 'iife', outfile: output, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' } })
  const css = (await require('postcss')([require('@tailwindcss/postcss')()]).process((await fs.readFile('app/globals.css', 'utf8')) + '\n@source "../components";', { from: path.resolve('app/globals.css') })).css
  const server = http.createServer(async (req, res) => {
    if (req.url === '/client.js') { res.setHeader('content-type', 'application/javascript'); return res.end(await fs.readFile(output)) }
    if (req.url === '/styles.css') { res.setHeader('content-type', 'text/css'); return res.end(css) }
    res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/client.js"></script></body></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const browser = await require('playwright').chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, hasTouch: width === 390, isMobile: width === 390 })
      const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message))
      await page.goto(`http://127.0.0.1:${server.address().port}`)
      await page.getByRole('heading', { name: 'Weekly recipe emails' }).waitFor()
      assert.equal(await page.getByRole('row', { name: 'Tracked active send' }).locator('td').filter({hasText:/^10\.0%/}).count(), 3)
      assert.equal(await page.getByRole('row', { name: 'Tracked zero send' }).locator('td').filter({hasText:/^0\.0%/}).count(), 3)
      assert.equal(await page.getByRole('row', { name: 'Historical send' }).getByText('Not tracked', { exact: true }).count(), 3)
      assert.equal(await page.getByText('5.0%', { exact: true }).count(), 3)
      await page.getByText('How engagement is measured', { exact: true }).first().click()
      await page.getByText(/Acceptance does not confirm inbox delivery/).first().waitFor()
      await page.getByRole('alert').filter({ hasText: 'Engagement data could not be loaded' }).waitFor()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await page.screenshot({ path: `tmp/operator-tests/recipe-email-engagement-${width}.png`, fullPage: true })
      assert.deepEqual(errors, [])
      console.log(`PASS recipe email engagement ${width}px: weighted rates, real zero vs historical unknown, charts, measurement definitions, failure state, responsive table`)
      await context.close()
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })

