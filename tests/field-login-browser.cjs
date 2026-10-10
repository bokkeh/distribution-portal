/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser verification. */
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const http = require('node:http')
const { build } = require('esbuild')

async function main() {
  const stubs={
    'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search)`,
    'next/image': `import React from 'react';export default function Image({priority,fill,...props}){return <img {...props}/>}`,
  }
  const built=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {PublicAgeGate} from './components/layout/PublicAgeGate';createRoot(document.getElementById('root')).render(<PublicAgeGate><button>Continue with Google</button></PublicAgeGate>)`,loader:'jsx',resolveDir:process.cwd()},bundle:true,platform:'browser',format:'iife',write:false,jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'navigation-boundary',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'stub'}:undefined);b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:stubs[a.path],loader:'jsx',resolveDir:process.cwd()}))}}]})
  const server=http.createServer((req,res)=>{res.setHeader('content-type',req.url==='/client.js'?'application/javascript':'text/html');res.end(req.url==='/client.js'?built.outputFiles[0].text:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/client.js"></script>')})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const browser=await require('playwright').chromium.launch({channel:'chrome',headless:true})
  try {
    for(const width of [390,1280]) {
      const context=await browser.newContext({viewport:{width,height:844},isMobile:width===390,hasTouch:width===390})
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
      const base=`http://127.0.0.1:${server.address().port}`
      for(const route of ['/field','/login?next=%2Ffield','/login?next=%2Ffield%3Finvoice%3D123']) {
        await page.goto(base+route)
        await page.getByRole('button',{name:'Continue with Google'}).waitFor()
        assert.equal(await page.getByRole('combobox').count(),0)
        await page.reload()
        await page.getByRole('button',{name:'Continue with Google'}).waitFor()
      }
      await page.goto(base+'/login')
      await page.getByRole('combobox').first().waitFor()
      assert.equal(await page.getByRole('button',{name:'Continue with Google'}).count(),0)
      assert.deepEqual(errors,[])
      await context.close()
      console.log(`Field age-gate verification passed at ${width}px`)
    }
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));await fs.mkdir('tmp/operator-tests',{recursive:true})}
}
main().catch(error=>{console.error(error);process.exitCode=1})
