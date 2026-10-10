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
  await h.runtime.db.insert(h.api.schema.tastings).values([
    {customerId:h.accountId,createdByUserId:h.runtime.session.user.id,eventName:'Previous shelf tasting',status:'completed',assignedUserId:h.rachelId,scheduledAt:new Date('2025-11-01T20:00:00Z'),endAt:new Date('2025-11-01T23:00:00Z'),timeZone:'America/Chicago'},
    ...Array.from({length:7},(_,i)=>({customerId:h.accountId,createdByUserId:h.runtime.session.user.id,eventName:'Future field visit '+(i+1),status:i===0?'requested':'confirmed',scheduledAt:new Date(Date.UTC(2030,10,7+i,21)),endAt:new Date(Date.UTC(2030,10,7+i,23)),storeAddress:'Second location'})),
  ])
  await h.runtime.db.update(h.api.schema.customerAccounts).set({pocName:'Alex Client',pocPhone:'(410) 555-0111',pocEmail:'alexclient@example.test',businessPhone:'410-555-0120',businessEmail:'business@example.test'}).where(require('drizzle-orm').eq(h.api.schema.customerAccounts.id,h.accountId))
  await h.runtime.db.insert(h.api.schema.contacts).values([
    {customerId:h.accountId,name:'Alex Client',title:'Buyer',isPrimary:true,phone:'(410) 555-0111',email:'alexclient@example.test',preferredContact:'call'},
    {customerId:h.accountId,name:'Jamie Manager',title:'Store manager',email:'manager@example.test'},
    {customerId:null,name:'Standalone private contact',email:'private@example.test'},
  ])
  await h.runtime.db.update(h.api.schema.users).set({avatarUrl:'https://storage.googleapis.com/test-bucket/avatars/rachel.png'}).where(require('drizzle-orm').eq(h.api.schema.users.id,h.rachelId))
  let avatarBroken=false
  const rpc = names => `const call = async (name,args) => { const r = await fetch('/action/'+name,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(args)}); const data=await r.json(); if(!r.ok) throw new Error(data.error); return data }; ${names.map(name => `export const ${name} = (...args) => call('${name}',args);`).join('\n')}`
  const stubs = {
    '@/actions/field-data': rpc(['createFieldAccount','createFieldContact','updateFieldContact','updateFieldAccountContact','getFieldAccount','getFieldAccountTastings','searchFieldAccounts','saveFieldNote','saveFieldPhoto','getFieldAvailability']),
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
  let failNote = false, failHistory = false, failContacts = false
  let failAccount = false, failDocument = false
  let uploads = 0, losePhotoResponse = false
  let failContactSave=false, loseContactResponse=false
  const calls = {}
  const server = http.createServer(async(req,res)=>{
    try {
      res.setHeader('content-type','application/json')
      if(req.url==='/field-client.js'){res.setHeader('content-type','application/javascript');return res.end(await fs.readFile('tmp/operator-tests/field-client.js'))}
      if(req.url==='/styles.css'){res.setHeader('content-type','text/css');return res.end(css)}
      if(req.url==='/brand/logo-badge.png'){res.setHeader('content-type','image/png');return res.end(await fs.readFile('public/brand/logo-badge.png'))}
      if(req.url==='/field-state')return res.end(JSON.stringify({bootstrap:await h.api.getFieldBootstrap(),availability:await h.api.getFieldAvailability()}))
      if(req.url.startsWith('/api/image?path=avatars%2Frachel')){if(avatarBroken){res.statusCode=404;return res.end()}res.setHeader('content-type','image/png');return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9X8AAAAASUVORK5CYII=','base64'))}
      if(req.url==='/api/upload'){ for await(const chunk of req){ void chunk }; uploads++; await new Promise(resolve=>setTimeout(resolve,100)); return res.end(JSON.stringify({publicUrl:`/api/image?path=account-media%2Fphoto-${uploads}.jpg`})) }
      if(req.url.startsWith('/action/')){
        const name=req.url.slice('/action/'.length);calls[name]=(calls[name]??0)+1
        const chunks=[];for await(const chunk of req)chunks.push(chunk)
        let args=JSON.parse(Buffer.concat(chunks).toString())
        if(name==='getFieldAccountTastings' && failHistory){failHistory=false;res.statusCode=500;return res.end(JSON.stringify({error:'Connection lost'}))}
        if(name==='getFieldAccount' && failContacts){failContacts=false;res.statusCode=500;return res.end(JSON.stringify({error:'Connection lost'}))}
        if(['createFieldContact','updateFieldContact'].includes(name) && failContactSave){failContactSave=false;return res.end(JSON.stringify({error:'Connection failed. Contact details kept.'}))}
        if(['createFieldContact','updateFieldContact'].includes(name))await new Promise(resolve=>setTimeout(resolve,150))
        if(name==='saveFieldNote' && failNote){failNote=false;return res.end(JSON.stringify({error:'Connection failed. Your note is kept.'}))}
        if(name==='createFieldAccount' && failAccount){failAccount=false;return res.end(JSON.stringify({error:'Connection failed. Your account details are kept.'}))}
        if(name==='saveFieldDocument' && failDocument){failDocument=false;return res.end(JSON.stringify({error:'Connection failed. Your invoice details are kept.'}))}
        if(name==='createFieldAccount')await new Promise(resolve=>setTimeout(resolve,200))
        if(name==='saveFieldDocument')await new Promise(resolve=>setTimeout(resolve,200))
        if(name==='saveAccountObservations'){const f=new FormData();for(const [k,v]of Object.entries(args[0]))f.set(k,v);args=[f]}
        if(typeof h.api[name]!=='function')throw new Error('Unknown test action')
        const result=await h.api[name](...args)
        if(['createFieldContact','updateFieldContact'].includes(name) && loseContactResponse && result.success){loseContactResponse=false;return res.end(JSON.stringify({error:'Connection lost after contact save. Retry to confirm.'}))}
        if(name==='saveFieldPhoto' && losePhotoResponse){losePhotoResponse=false;return res.end(JSON.stringify({error:'Connection lost after save. Retry to confirm.'}))}
        return res.end(JSON.stringify(result))
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
      await page.getByRole('button',{name:'Add new account',exact:true}).click()
      await page.getByRole('button',{name:'Save account & continue',exact:true}).click()
      await page.getByRole('alert').filter({hasText:'An account with this name already exists'}).waitFor()
      await page.getByRole('button',{name:'Use Test Venue · Ellicott City',exact:true}).click()
      await page.getByRole('button',{name:'Change',exact:true}).click()
      const fieldName=`Field Mobile Venue ${width}`
      await page.getByLabel('Find the account').fill(fieldName)
      await page.getByRole('button',{name:'Add new account',exact:true}).click()
      assert.equal(await page.getByLabel('Account name',{exact:true}).inputValue(),fieldName)
      await page.getByText('Location & contact (optional)',{exact:true}).click()
      await page.getByLabel('City',{exact:true}).fill('Baltimore')
      failAccount=true;await page.getByRole('button',{name:'Save account & continue',exact:true}).click()
      await page.getByText('Connection failed. Your account details are kept.',{exact:true}).waitFor()
      assert.equal(await page.getByLabel('Account name',{exact:true}).inputValue(),fieldName)
      assert.equal(await page.getByLabel('City',{exact:true}).inputValue(),'Baltimore')
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      await page.screenshot({path:`tmp/operator-tests/field-account-create-${width}.png`,fullPage:true})
      const accountCalls=calls.createFieldAccount??0
      await page.getByRole('button',{name:'Save account & continue',exact:true}).evaluate(button=>{button.click();button.click()})
      await page.getByText(`${fieldName} saved. Ready for field tasks.`,{exact:true}).waitFor()
      assert.equal(calls.createFieldAccount,accountCalls+1)
      await page.getByRole('button',{name:'Change',exact:true}).click()
      await page.getByLabel('Find the account').fill('Test Venue')
      await page.getByRole('button',{name:/Test Venue.*Ellicott/}).click()
      await page.getByRole('button',{name:'Create order Cases, payment & invoice'}).waitFor()
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      await page.screenshot({path:`tmp/operator-tests/field-home-${width}.png`,fullPage:true})
      await page.getByRole('button',{name:'Contact information Key points of contact',exact:true}).click()
      await page.getByRole('heading',{name:'Contact information',exact:true}).waitFor()
      assert.equal(await page.getByRole('heading',{name:'Alex Client',exact:true}).count(),1)
      await page.getByText('Primary contact · Buyer',{exact:true}).waitFor()
      await page.getByRole('heading',{name:'Jamie Manager',exact:true}).waitFor()
      assert.equal(await page.getByRole('link',{name:'Call Alex Client: (410) 555-0111',exact:true}).getAttribute('href'),'tel:4105550111')
      assert.equal(await page.getByRole('link',{name:'Email Alex Client: alexclient@example.test',exact:true}).getAttribute('href'),'mailto:alexclient%40example.test')
      assert.equal(await page.getByText('Standalone private contact',{exact:true}).count(),0)
      failContacts=true
      await page.getByRole('button',{name:'Refresh contacts',exact:true}).click()
      await page.getByRole('alert').filter({hasText:'Could not refresh contacts'}).waitFor()
      await page.getByRole('button',{name:'Refresh contacts',exact:true}).click()
      await page.getByRole('alert').filter({hasText:'Could not refresh contacts'}).waitFor({state:'hidden'})
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      await page.screenshot({path:`tmp/operator-tests/field-contacts-${width}.png`,fullPage:true})
      const contactName='New buyer '+width, contactCalls=calls.createFieldContact??0
      const contactRowsBefore=(await h.runtime.db.select().from(h.api.schema.contacts)).length
      await page.getByRole('button',{name:'Add contact',exact:true}).click()
      await page.getByLabel('Contact name',{exact:true}).fill(contactName)
      await page.getByLabel('Contact phone (optional)',{exact:true}).fill('4105550140')
      await page.getByLabel('Contact email (optional)',{exact:true}).fill('buyer'+width+'@example.test')
      await page.getByText('Role & preferences (optional)',{exact:true}).click()
      await page.getByLabel('Job title / role',{exact:true}).fill('Buyer')
      failContactSave=true
      await page.getByRole('button',{name:'Save contact',exact:true}).click()
      await page.getByText('Connection failed. Contact details kept.',{exact:true}).waitFor()
      assert.equal(await page.getByLabel('Contact name',{exact:true}).inputValue(),contactName)
      assert.equal(await page.getByLabel('Contact phone (optional)',{exact:true}).inputValue(),'4105550140')
      assert.equal(await page.getByLabel('Contact email (optional)',{exact:true}).inputValue(),'buyer'+width+'@example.test')
      loseContactResponse=true
      await page.getByRole('button',{name:'Save contact',exact:true}).click()
      await page.getByText('Connection lost after contact save. Retry to confirm.',{exact:true}).waitFor()
      await page.getByRole('button',{name:'Save contact',exact:true}).evaluate(button=>{button.click();button.click()})
      await page.getByText(contactName+' saved to this account.',{exact:true}).waitFor()
      await page.getByRole('heading',{name:contactName,exact:true}).waitFor()
      assert.equal(calls.createFieldContact,contactCalls+3)
      assert.equal((await h.runtime.db.select().from(h.api.schema.contacts)).length,contactRowsBefore+1)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      await page.getByRole('button',{name:'Edit '+contactName,exact:true}).click()
      assert.equal(await page.getByLabel('Contact name',{exact:true}).inputValue(),contactName)
      await page.getByLabel('Job title / role',{exact:true}).fill('Regional buyer')
      await page.getByLabel('Contact email (optional)',{exact:true}).fill('edited'+width+'@example.test')
      await page.getByLabel('Contact phone (optional)',{exact:true}).fill('410-555-0999')
      await page.screenshot({path:`tmp/operator-tests/field-contact-edit-${width}.png`,fullPage:true})
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      failContactSave=true
      await page.getByRole('button',{name:'Save contact',exact:true}).click()
      await page.getByText('Connection failed. Contact details kept.',{exact:true}).waitFor()
      assert.equal(await page.getByLabel('Job title / role',{exact:true}).inputValue(),'Regional buyer')
      loseContactResponse=true
      await page.getByRole('button',{name:'Save contact',exact:true}).click()
      await page.getByText('Connection lost after contact save. Retry to confirm.',{exact:true}).waitFor()
      const editCalls=calls.updateFieldContact
      await page.getByRole('button',{name:'Save contact',exact:true}).evaluate(button=>{button.click();button.click()})
      await page.getByRole('button',{name:'Edit '+contactName,exact:true}).waitFor({state:'visible'})
      await page.getByRole('button',{name:'Cancel editing contact',exact:true}).waitFor({state:'hidden'})
      assert.equal(calls.updateFieldContact,editCalls+1)
      const edited=(await h.runtime.db.select().from(h.api.schema.contacts)).find(row=>row.name===contactName)
      assert.equal(edited.title,'Regional buyer');assert.equal(edited.phone,'410-555-0999');assert.equal(edited.email,'edited'+width+'@example.test')
      assert.equal((await h.runtime.db.select().from(h.api.schema.contacts)).length,contactRowsBefore+1)
      await page.getByRole('button',{name:'Edit '+contactName,exact:true}).click()
      assert.equal(await page.getByLabel('Job title / role',{exact:true}).inputValue(),'Regional buyer')
      await page.getByRole('button',{name:'Cancel editing contact',exact:true}).click()
      await page.getByRole('button',{name:'Add contact',exact:true}).click()
      await page.getByLabel('Contact name',{exact:true}).fill('Duplicate buyer')
      await page.getByLabel('Contact email (optional)',{exact:true}).fill('edited'+width+'@example.test')
      await page.getByRole('button',{name:'Save contact',exact:true}).click()
      await page.getByRole('alert').filter({hasText:'is already listed for this account'}).waitFor()
      await page.getByRole('button',{name:'Cancel adding contact',exact:true}).click()
      await page.getByRole('button',{name:'Back to field tasks'}).click()
      await page.getByRole('button',{name:'Contact information Key points of contact',exact:true}).click()
      await page.getByRole('heading',{name:contactName,exact:true}).waitFor()
      await page.getByRole('button',{name:'Edit '+contactName,exact:true}).click()
      assert.equal(await page.getByLabel('Contact phone (optional)',{exact:true}).inputValue(),'410-555-0999')
      await page.getByRole('button',{name:'Cancel editing contact',exact:true}).click()

      await page.getByRole('button',{name:'Back to field tasks'}).click()
      failHistory=true
      await page.getByRole('button',{name:'View tastings Last visit & future bookings',exact:true}).click()
      await page.getByRole('alert').filter({hasText:'Could not refresh this account’s tastings'}).waitFor()
      await page.getByRole('button',{name:'Refresh tastings',exact:true}).click()
      await page.getByText('Previous shelf tasting',{exact:true}).waitFor()
      await page.getByText('Nov 1, 2025 · 3–6 PM CDT',{exact:true}).waitFor()
      await page.getByText('Future field visit 1',{exact:true}).waitFor()
      assert.equal(await page.getByText('Future field visit 7',{exact:true}).count(),0)
      await page.getByRole('button',{name:/Show more tastings/}).click()
      await page.getByText('Future field visit 7',{exact:true}).waitFor()
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      await page.screenshot({path:`tmp/operator-tests/field-tastings-${width}.png`,fullPage:true})
      await page.getByRole('button',{name:'Back to field tasks'}).click()
      await page.getByRole('button',{name:'Quick note Capture the conversation'}).click()
      await page.getByLabel('What happened?').fill('Client asked for a shelf visit.')
      failNote=true;await page.getByRole('button',{name:'Save note',exact:true}).click()
      await page.getByText('Connection failed. Your note is kept.').waitFor()
      assert.equal(await page.getByLabel('What happened?').inputValue(),'Client asked for a shelf visit.')
      await page.getByRole('button',{name:'Save note',exact:true}).click();await page.getByText('Note saved to this account.').waitFor()
      await page.getByRole('button',{name:'Back to field tasks'}).click()
      await page.getByRole('button',{name:'Schedule tasting Open dates & team assignment'}).click()
      await page.getByText('Previous shelf tasting',{exact:true}).waitFor()
      if(width===1280) await page.getByRole('button',{name:'Include booked dates'}).click()
      const photo=page.getByRole('img',{name:'Rachel profile photo',exact:true}).first()
      await photo.waitFor()
      assert.equal(await photo.getAttribute('src'),'/api/image?path=avatars%2Frachel.png')
      await page.waitForFunction(()=>Array.from(document.querySelectorAll('img')).some(img=>img.alt==='Rachel profile photo' && img.complete && img.naturalWidth>0))
      avatarBroken=true
      await h.runtime.db.update(h.api.schema.users).set({avatarUrl:'https://storage.googleapis.com/test-bucket/avatars/rachel-missing-'+width+'.png'}).where(require('drizzle-orm').eq(h.api.schema.users.id,h.rachelId))
      await page.getByRole('button',{name:'Back to field tasks'}).click()
      await page.getByRole('button',{name:'Schedule tasting Open dates & team assignment'}).click()
      if(width===1280) await page.getByRole('button',{name:'Include booked dates'}).click()
      await page.getByRole('button',{name:'Refresh',exact:true}).click()
      await page.getByRole('button',{name:/Nov.*6.*Rachel/}).getByText('R',{exact:true}).waitFor()
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      avatarBroken=false
      await h.runtime.db.update(h.api.schema.users).set({avatarUrl:'https://storage.googleapis.com/test-bucket/avatars/rachel.png'}).where(require('drizzle-orm').eq(h.api.schema.users.id,h.rachelId))
      await page.getByRole('button',{name:/Nov.*6.*Rachel/}).click()
      assert.equal(await page.getByLabel('Assigned team member').inputValue(),h.rachelId)
      assert.equal(await page.getByLabel('Date',{exact:true}).inputValue(),'2030-11-06')
      // Only book once; second width verifies the already-booked availability and chooses Unassigned.
      if(width===390){await page.getByRole('button',{name:'Schedule tasting',exact:true}).click();await page.getByText('Tasting saved',{exact:true}).waitFor();await page.getByRole('heading',{name:'Upcoming & requested tastings (8)',exact:true}).waitFor();await page.getByRole('region',{name:'Account tastings',exact:true}).getByText('Test Venue',{exact:true}).waitFor()}
      await page.getByRole('button',{name:'Back to field tasks'}).click()
      await page.getByRole('button',{name:'View tastings Last visit & future bookings',exact:true}).click()
      await page.getByRole('heading',{name:'Upcoming & requested tastings (8)',exact:true}).waitFor()
      await page.reload()
      await page.getByLabel('Find the account').fill('Test Venue')
      await page.getByRole('button',{name:/Test Venue.*Ellicott/}).click()
      await page.getByRole('button',{name:'View tastings Last visit & future bookings',exact:true}).click()
      await page.getByRole('heading',{name:'Upcoming & requested tastings (8)',exact:true}).waitFor()
      await page.getByRole('region',{name:'Account tastings',exact:true}).getByText('Test Venue',{exact:true}).waitFor()
      await page.getByRole('button',{name:'Back to field tasks'}).click()
      await page.getByRole('button',{name:'Price & inventory Record either or both'}).click()
      await page.getByLabel('Product / SKU').selectOption(h.productId)
      await page.getByLabel('Observed retail price (optional)').fill('24.99')
      await page.getByRole('button',{name:/Save observation/}).click();await page.getByText('Price saved.',{exact:true}).waitFor()
      await page.getByRole('button',{name:'Back to field tasks'}).click()
      await page.getByRole('button',{name:'Add photos Shelf, display or client visit'}).click()
      const image = name => ({name,mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9X8AAAAASUVORK5CYII=','base64')})
      assert.equal(await page.getByLabel('Choose from gallery').getAttribute('capture'),null)
      assert.notEqual(await page.getByLabel('Choose from gallery').getAttribute('multiple'),null)
      assert.equal(await page.getByLabel('Take a photo').getAttribute('capture'),'environment')
      await page.getByLabel('Choose from gallery').setInputFiles([image('shelf.png'),image('display.png')])
      await page.getByLabel('Take a photo').setInputFiles(image('visit.png'))
      await page.getByLabel('Caption for new photos (optional)').fill('Field visit')
      const uploadsBefore=uploads, photosBefore=calls.saveFieldPhoto??0
      const rowsBefore=(await h.runtime.db.select().from(h.api.schema.accountMedia)).length
      losePhotoResponse=true
      await page.getByRole('button',{name:'Save 3 photos to account'}).evaluate(button=>{button.click();button.click()})
      await page.getByText('2 photos confirmed saved. 1 could not be confirmed; retry unsaved photos below.',{exact:true}).waitFor()
      assert.equal(uploads,uploadsBefore+3);assert.equal(calls.saveFieldPhoto,photosBefore+3)
      assert.equal(await page.getByLabel('Caption for new photos (optional)').inputValue(),'Field visit')
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      await page.screenshot({path:`tmp/operator-tests/field-photos-${width}.png`,fullPage:true})
      await page.getByRole('button',{name:'Retry unsaved photos'}).click()
      await page.getByText('1 photo saved to this account.',{exact:true}).waitFor()
      assert.equal(uploads,uploadsBefore+3);assert.equal(calls.saveFieldPhoto,photosBefore+4)
      assert.equal((await h.runtime.db.select().from(h.api.schema.accountMedia)).length,rowsBefore+3)
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
      await page.getByRole('button',{name:'Back to field tasks',exact:true}).click()
      await page.getByRole('button',{name:'Quick invoice Create & send to customer',exact:true}).click()
      assert.equal(await page.getByRole('button',{name:'Saved products',exact:true}).getAttribute('aria-pressed'),'true')
      await page.getByRole('button',{name:'Custom amount',exact:true}).click()
      await page.getByLabel('What is this invoice for?',{exact:true}).fill('Custom service')
      await page.getByLabel('Amount (USD)',{exact:true}).fill('15')
      await page.getByRole('button',{name:'Review total',exact:true}).click()
      await page.getByText('Review invoice',{exact:true}).waitFor()
      await page.getByRole('button',{name:'Edit entry',exact:true}).click()
      assert.equal(await page.getByLabel('Amount (USD)',{exact:true}).inputValue(),'15')
      await page.getByRole('button',{name:'Saved products',exact:true}).click()
      await page.getByRole('spinbutton',{name:'Test Vodka cases',exact:true}).fill('3')
      await page.getByLabel('Customer email (optional)',{exact:true}).fill('client@example.test')
      await page.getByRole('button',{name:'Review total',exact:true}).click()
      await page.getByText('Review invoice',{exact:true}).waitFor()
      await page.getByText('3 cases × $100.00 $300.00',{exact:true}).waitFor()
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      await page.screenshot({path:`tmp/operator-tests/field-product-invoice-${width}.png`,fullPage:true})
      failDocument=true;await page.getByRole('button',{name:'Create & email invoice',exact:true}).click()
      await page.getByRole('alert').filter({hasText:'Connection failed. Your invoice details are kept.'}).waitFor()
      await page.getByRole('button',{name:'Edit entry',exact:true}).click()
      assert.equal(await page.getByRole('spinbutton',{name:'Test Vodka cases',exact:true}).inputValue(),'3')
      await page.getByRole('button',{name:'Review total',exact:true}).click()
      await page.getByText('Review invoice',{exact:true}).waitFor()
      const invoiceCalls=calls.saveFieldDocument??0
      await page.getByRole('button',{name:'Create & email invoice',exact:true}).evaluate(button=>{button.click();button.click()})
      await page.getByText('Invoice saved',{exact:true}).waitFor()
      assert.equal(calls.saveFieldDocument,invoiceCalls+1)
      assert.deepEqual(errors,[])
      console.log(`PASS field ${width}px: new account, duplicate selection, retained failed account/invoice/note, availability, observations, photos, orders, saved-product/custom invoice, repeated taps and email retry`)
      await context.close()
    }
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));await h.pg.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
