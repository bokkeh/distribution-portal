/* eslint-disable @typescript-eslint/no-require-imports -- Standalone isolated browser verification. */
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const http = require('node:http')
const path = require('node:path')
const { build } = require('esbuild')
const { createHarness } = require('./operator-harness.cjs')

async function main() {
  process.env.INVOICE_PUBLIC_LINK_SECRET = 'isolated-field-browser-only'
  const h = await createHarness()
  await h.runtime.db.insert(h.api.schema.inventory).values({ productId: h.productId, quantityPaid: 40 })
  await h.runtime.db.insert(h.api.schema.tasterAvailability).values({ userId: h.rachelId, availableDate: '2030-11-06' })
  const rpc = names => `const call = async (name,args) => { const r = await fetch('/action/'+name,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(args)}); const data=await r.json(); if(!r.ok) throw new Error(data.error); return data }; ${names.map(name => `export const ${name} = (...args) => call('${name}',args);`).join('\n')}`
  const stubs = {
    '@/actions/field-data': rpc(['getFieldAccount','searchFieldAccounts','saveFieldNote','saveFieldPhoto','getFieldAvailability']),
    '@/actions/field-documents': rpc(['quoteFieldDocument','saveFieldDocument','sendFieldInvoice','getFieldDocument','startFieldCardPayment']),
    '@/actions/quick-schedule-tasting': rpc(['quickScheduleTasting']),
    '@/actions/account-observations': rpc(['saveAccountObservations']).replace("call('saveAccountObservations',args)", "call('saveAccountObservations',[Object.fromEntries(args[0])])"),
    'next/navigation': 'export function useRouter(){ return {refresh:()=>window.operatorRefresh(),push:()=>{}} }',
    'next/link': `import React from 'react'; export default function Link({children,...props}){return <a {...props}>{children}</a>}`,
    'next/image': `import React from 'react'; export default function Image(props){return <img {...props}/>}`,
    './FieldCardPayment': `import React from 'react'; export function FieldCardPayment(){return <div>Stripe provider boundary — no real card or charge in browser tests.</div>}`,
  }
  await build({ entryPoints:['tests/fixtures/field-browser.jsx'],bundle:true,platform:'browser',format:'iife',outfile:'tmp/operator-tests/field-client.js',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"','process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY':'""'},plugins:[{name:'isolated-field-boundaries',setup(b){b.onResolve({filter:/.*/},args=>Object.hasOwn(stubs,args.path)?{path:args.path,namespace:'test'}:undefined);b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:stubs[args.path],loader:'jsx',resolveDir:process.cwd()}))}}] })
  const css = (await require('postcss')([require('@tailwindcss/postcss')()]).process((await fs.readFile('app/globals.css','utf8'))+'\n@source "../components";',{from:path.resolve('app/globals.css')})).css
  let failNote = false
  const calls = {}
  const server = http.createServer(async(req,res)=>{
    try {
      res.setHeader('content-type','application/json')
      if(req.url==='/field-client.js'){res.setHeader('content-type','application/javascript');return res.end(await fs.readFile('tmp/operator-tests/field-client.js'))}
      if(req.url==='/styles.css'){res.setHeader('content-type','text/css');return res.end(css)}
      if(req.url==='/brand/logo-badge.png'){res.setHeader('content-type','image/png');return res.end(await fs.readFile('public/brand/logo-badge.png'))}
      if(req.url==='/field-state')return res.end(JSON.stringify({bootstrap:await h.api.getFieldBootstrap(),availability:await h.api.getFieldAvailability()}))
      if(req.url==='/api/upload')return res.end(JSON.stringify({publicUrl:'https://example.test/field-photo.jpg'}))
      if(req.url.startsWith('/action/')){
        const name=req.url.slice('/action/'.length);calls[name]=(calls[name]??0)+1
        const chunks=[];for await(const chunk of req)chunks.push(chunk)
        let args=JSON.parse(Buffer.concat(chunks).toString())
        if(name==='saveFieldNote' && failNote){failNote=false;return res.end(JSON.stringify({error:'Connection failed. Your note is kept.'}))}
        if(name==='saveFieldDocument')await new Promise(resolve=>setTimeout(resolve,200))
        if(name==='saveAccountObservations'){const f=new FormData();for(const [k,v]of Object.entries(args[0]))f.set(k,v);args=[f]}
        if(typeof h.api[name]!=='function')throw new Error('Unknown test action')
        return res.end(JSON.stringify(await h.api[name](...args)))
      }
      res.setHeader('content-type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/field-client.js"></script></body></html>')
    }catch(error){res.statusCode=500;res.end(JSON.stringify({error:error.message}))}
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const browser=await require('playwright').chromium.launch({channel:'chrome',headless:true})
  try{
    for(const width of [390,1280]){
      const context=await browser.newContext({viewport:{width,height:844},hasTouch:width===390,isMobile:width===390})
      const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message))
      await page.goto(`http://127.0.0.1:${server.address().port}/field`)
      await page.getByLabel('Find the account').fill('Test Venue')
      await page.getByRole('button',{name:/Test Venue.*Ellicott/}).click()
      await page.getByRole('button',{name:'Create order Cases, payment & invoice'}).waitFor()
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      await page.screenshot({path:`tmp/operator-tests/field-home-${width}.png`,fullPage:true})
      await page.getByRole('button',{name:'Quick note Capture the conversation'}).click()
      await page.getByLabel('What happened?').fill('Client asked for a shelf visit.')
      failNote=true;await page.getByRole('button',{name:'Save note',exact:true}).click()
      await page.getByText('Connection failed. Your note is kept.').waitFor()
      assert.equal(await page.getByLabel('What happened?').inputValue(),'Client asked for a shelf visit.')
      await page.getByRole('button',{name:'Save note',exact:true}).click();await page.getByText('Note saved to this account.').waitFor()
      await page.getByRole('button',{name:'Back to field tasks'}).click()
      await page.getByRole('button',{name:'Schedule tasting Open dates & team assignment'}).click()
      if(width===1280) await page.getByRole('button',{name:'Include booked dates'}).click()
      await page.getByRole('button',{name:/Nov.*6.*Rachel/}).click()
      assert.equal(await page.getByLabel('Assigned team member').inputValue(),h.rachelId)
      assert.equal(await page.getByLabel('Date',{exact:true}).inputValue(),'2030-11-06')
      // Only book once; second width verifies the already-booked availability and chooses Unassigned.
      if(width===390){await page.getByRole('button',{name:'Schedule tasting',exact:true}).click();await page.getByText('Tasting saved',{exact:true}).waitFor();await page.getByText(/Rachel/).first().waitFor()}
      await page.getByRole('button',{name:'Back to field tasks'}).click()
      await page.getByRole('button',{name:'Price & inventory Record either or both'}).click()
      await page.getByLabel('Product / SKU').selectOption(h.productId)
      await page.getByLabel('Observed retail price (optional)').fill('24.99')
      await page.getByRole('button',{name:/Save observation/}).click();await page.getByText('Price saved.',{exact:true}).waitFor()
      await page.getByRole('button',{name:'Back to field tasks'}).click()
      await page.getByRole('button',{name:'Add photos Shelf, display or client visit'}).click()
      await page.getByLabel('Take or choose photo').setInputFiles({name:'shelf.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9X8AAAAASUVORK5CYII=','base64')})
      await page.getByRole('button',{name:'Save photo to account'}).click();await page.getByText('Photo saved to this account.').waitFor()
      await page.getByRole('button',{name:'Back to field tasks'}).click()
      await page.getByRole('button',{name:'Create order Cases, payment & invoice'}).click()
      await page.getByRole('spinbutton',{name:'Test Vodka cases'}).fill('2');await page.getByLabel('Customer email (optional)').fill('client@example.test')
      await page.getByRole('button',{name:'Review total',exact:true}).click();await page.getByText('Review order & invoice',{exact:true}).waitFor()
      await page.getByRole('button',{name:'Edit entry',exact:true}).click();assert.equal(await page.getByRole('spinbutton',{name:'Test Vodka cases'}).inputValue(),'2')
      await page.getByRole('button',{name:'Review total',exact:true}).click();await page.getByText('Review order & invoice',{exact:true}).waitFor()
      const before=calls.saveFieldDocument??0
      await page.locator('button').filter({hasText:'Create order & email invoice'}).evaluate(button=>{button.click();button.click()})
      await page.getByText('Order & invoice saved',{exact:true}).waitFor();assert.equal(calls.saveFieldDocument,before+1)
      assert.match(await page.locator('body').innerText(),/Payment not yet confirmed/)
      h.runtime.emailSuccess=true
      await page.getByRole('button',{name:'Email invoice to customer',exact:true}).click();await page.getByText(/Invoice (emailed|already emailed) to client/).waitFor()
      await page.screenshot({path:`tmp/operator-tests/field-saved-${width}.png`,fullPage:true})
      assert.deepEqual(errors,[])
      console.log(`PASS field ${width}px: account search, retained failed note, availability selection, price-only save, photo upload/save, retained order edit, repeated taps, saved invoice and email retry`)
      await context.close()
    }
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));await h.pg.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
