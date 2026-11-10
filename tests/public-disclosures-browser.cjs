/* eslint-disable @typescript-eslint/no-require-imports -- Production HTML/browser regression check. */
const assert = require('node:assert/strict')
const { chromium } = require('playwright')

async function main() {
  const base = process.env.BASE_URL || 'http://localhost:3107'
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' })
  try {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    for (const [path, heading] of [
      ['/privacy', 'Privacy Policy'],
      ['/terms', 'Terms & Conditions'],
      ['/sms-consent/taster', 'AHAWC taster SMS consent form'],
    ]) {
      const response = await fetch(base + path)
      assert.equal(response.status, 200, path)
      const html = await response.text()
      const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')
      assert.match(text, path === '/privacy' ? /Mobile phone numbers and SMS opt-in data are not shared/ : /STOP/, path + ' must include SMS disclosures in initial HTML')
      assert.doesNotMatch(text, /No account linked yet|Loading portal/, path)
      await page.goto(base + path)
      assert.equal(await page.getByRole('heading', { name: heading, exact: true }).isVisible(), true, path)
      assert.equal(await page.getByRole('heading', { name: 'You must be 21+ to enter', exact: true }).count(), 0, path)
      console.log('PASS raw HTML and JavaScript-disabled page:', path)
    }
    await page.goto(base)
    assert.equal(await page.getByRole('heading', { name: 'You must be 21+ to enter', exact: true }).isVisible(), true)
    console.log('PASS homepage retains age gate')
    await context.close()
    const interactive = await browser.newContext()
    const login = await interactive.newPage()
    await login.goto(base + '/login')
    await login.getByRole('heading', { name: 'You must be 21+ to enter', exact: true }).waitFor({ state: 'visible' })
    await login.goto(base + '/login?next=%2Ffield')
    await login.locator('form').getByRole('button', { name: 'Sign In', exact: true }).waitFor({ state: 'visible' })
    assert.equal(await login.getByRole('heading', { name: 'You must be 21+ to enter', exact: true }).count(), 0)
    console.log('PASS regular login age gate and field login exemption')
    await interactive.close()
  } finally {
    await browser.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
