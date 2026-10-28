/* eslint-disable @typescript-eslint/no-require-imports */
const http=require('node:http')
const assert=require('node:assert/strict')
const fs=require('node:fs/promises')
const {build}=require('esbuild')
const {chromium}=require('playwright')
const initial={paymentStatus:'unpaid',paymentMethod:null,status:'pending',shippingStatus:'not_scheduled',assignedDriverId:null}
let stored={...initial}, failure=false, calls=0
;(async()=>{
 await fs.mkdir('tmp/stakeholder-browser',{recursive:true})
 await build({entryPoints:['tests/fixtures/stakeholder-editor.tsx'],outfile:'tmp/stakeholder-browser/editor.js',bundle:true,platform:'browser',format:'iife',jsx:'automatic',plugins:[{name:'boundaries',setup(b){
  b.onResolve({filter:/^(@\/actions\/order-operations|next\/navigation)$/},args=>({path:args.path,namespace:'stub'}))
  b.onLoad({filter:/.*/,namespace:'stub'},args=>({loader:'js',contents:args.path==='next/navigation'?'export function useRouter(){return {refresh(){}}}':'export async function saveOrderOperations(input){const response=await fetch("/save",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)});return response.json()}' }))
 }}]})
 const bundle=await fs.readFile('tmp/stakeholder-browser/editor.js')
 const server=http.createServer(async(req,res)=>{
  if(req.url==='/editor.js'){res.setHeader('content-type','text/javascript');res.end(bundle);return}
  if(req.url==='/save'){
   let body='';for await(const chunk of req)body+=chunk
   const input=JSON.parse(body);calls++;res.setHeader('content-type','application/json')
   if(failure){res.end(JSON.stringify({error:'Synthetic database outage'}));return}
   if(JSON.stringify(input.expected)!==JSON.stringify(stored)){res.end(JSON.stringify({error:'This order changed elsewhere.',conflict:true}));return}
   stored=input.next;res.end(JSON.stringify({success:true,values:stored}));return
  }
  res.setHeader('content-type','text/html');res.end(req.url==='/other'?'<a href="/">Return to order</a>':`<!doctype html><meta charset="utf-8"><script>window.fixture=${JSON.stringify({initial:stored})}</script><div id="root"></div><script src="/editor.js"></script>`)
 })
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const base=`http://127.0.0.1:${server.address().port}`
 let browser
 try {
  browser=await chromium.launch({channel:'chrome',headless:true})
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message)})
  await page.goto(base)
  await page.getByLabel('Payment method',{exact:true}).selectOption('check')
  await page.getByRole('status').filter({hasText:/^Saved$/}).waitFor()
  assert.equal(stored.paymentMethod,'check')
  await page.reload();assert.equal(await page.getByLabel('Payment method',{exact:true}).inputValue(),'check')
  failure=true
  await page.getByLabel('Fulfillment status',{exact:true}).selectOption('confirmed')
  await page.getByRole('status').filter({hasText:'Failed to save'}).waitFor()
  let prompts=0
  const dismiss=async dialog=>{prompts++;await dialog.dismiss()}
  page.on('dialog',dismiss)
  await page.getByRole('link',{name:'Other page'}).click()
  assert.equal(new URL(page.url()).pathname,'/');assert.ok(prompts>0)
  page.off('dialog',dismiss)
  const accept=async dialog=>dialog.accept();page.on('dialog',accept)
  await page.getByRole('link',{name:'Other page'}).click()
  await page.getByRole('link',{name:'Return to order'}).click()
  await page.getByRole('status').filter({hasText:'Failed to save'}).waitFor()
  assert.equal(await page.getByLabel('Fulfillment status',{exact:true}).inputValue(),'confirmed')
  page.off('dialog',accept)
  failure=false
  await page.getByRole('button',{name:'Retry save'}).click()
  await page.getByRole('status').filter({hasText:/^Saved$/}).waitFor()
  assert.equal(stored.status,'confirmed')
  stored={...stored,status:'fulfilled'}
  await page.getByLabel('Shipping status',{exact:true}).selectOption('scheduled')
  await page.getByRole('status').filter({hasText:'changed elsewhere'}).waitFor()
  assert.equal(stored.shippingStatus,'not_scheduled')
  assert.equal(stored.status,'fulfilled')
  await page.screenshot({path:'tmp/stakeholder-browser/order-conflict.png',fullPage:true})
  await page.evaluate(value=>sessionStorage.setItem('order-operations:10000000-0000-4000-8000-000000000001',JSON.stringify({values:value,saved:{...value,status:'pending'}})),stored)
  page.on('dialog',async dialog=>dialog.accept())
  await page.reload()
  await page.getByRole('status').filter({hasText:/^Saved$/}).waitFor()
  assert.equal(await page.getByLabel('Fulfillment status',{exact:true}).inputValue(),'fulfilled')
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({passed:true,calls,checks:['autosave','reload persistence','visible failure','navigation warning','retained pending edits','retry','conflict protection','lost-response reload recovery'],screenshot:'tmp/stakeholder-browser/order-conflict.png'}))
 } finally {await browser?.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1})
