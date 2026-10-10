/* eslint-disable @typescript-eslint/no-require-imports -- Isolated auth boundary regression tests. */
const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs/promises')
const path = require('node:path')
const { build } = require('esbuild')

test('field login, persistent session, redirects and account revocation', async () => {
  const out = path.resolve('tmp/operator-tests/field-session.cjs')
  const stubs = {
    'next-auth': `export default function NextAuth(config){globalThis.fieldAuthConfig=config;return {auth:async handler=>handler,handlers:{}}}`,
    'next/headers': `export async function cookies(){return globalThis.fieldCookies}`,
    'next/server': `export class NextResponse {constructor(kind,url){this.kind=kind;this.url=url?.toString();this.savedCookies=[];this.cookies={set:(...args)=>this.savedCookies.push(args),delete:()=>{}}}static next(){return new NextResponse('next')}static redirect(url){return new NextResponse('redirect',url)}}`,
    '@/db': `export const db={select:()=>({from:table=>({where:()=>({limit:async()=>{globalThis.fieldReads++;return table[Symbol.for('drizzle:Name')]==='users'?(globalThis.fieldUser?[globalThis.fieldUser]:[]):[]}})})})}`,
    '@/lib/auth/activity': `export async function recordUserAccessEvent(){}`,
    '@/lib/auth/rate-limit': `export async function isLoginRateLimited(){return false}`,
  }
  await build({stdin:{contents:`export * from './lib/auth/field-session';import './lib/auth/config';export {default as proxy} from './proxy'`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:out,plugins:[{name:'auth-boundaries',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'stub'}:undefined);b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:stubs[a.path],resolveDir:process.cwd()}))}}]})
  const api = require(out)
  for (const next of ['/field', '/field?invoice=123']) assert.equal(api.requiresPublicAgeGate('/login',next),false)
  for (const next of [null,'/field-other','//evil.test/field','https://evil.test/field']) assert.equal(api.requiresPublicAgeGate('/login',next),true)
  for (const page of ['/','/privacy','/terms']) assert.equal(api.requiresPublicAgeGate(page,'/field'),true)
  const jar = value => ({get:name=>name===api.FIELD_DEVICE_COOKIE && value?{value}:undefined})
  globalThis.fieldCookies=jar('1')
  const remembered=await globalThis.fieldAuthConfig({cookies:jar('1')})
  const regular=await globalThis.fieldAuthConfig({cookies:jar(null)})
  assert.equal(remembered.session.maxAge,30*24*60*60)
  assert.equal(regular.session.maxAge,4*60*60)
  assert.equal((await globalThis.fieldAuthConfig()).session.maxAge,30*24*60*60)
  globalThis.fieldReads=0
  globalThis.fieldUser={id:'kim',active:true,role:'staff',roles:['staff'],name:'Kim',avatarUrl:null}
  const recent={id:'kim',role:'admin',roles:['admin'],accountCheckedAt:Date.now()}
  await remembered.callbacks.jwt({token:{...recent}})
  assert.equal(globalThis.fieldReads,0)
  const refreshed=await remembered.callbacks.jwt({token:{...recent,accountCheckedAt:Date.now()-6*60*1000}})
  assert.deepEqual(refreshed.roles,['staff'])
  assert.equal(refreshed.role,'staff')
  assert.ok(refreshed.accountCheckedAt>recent.accountCheckedAt-1000)
  globalThis.fieldUser.active=false
  assert.equal(await remembered.callbacks.jwt({token:{...recent,accountCheckedAt:0}}),null)
  globalThis.fieldUser=null
  assert.equal(await remembered.callbacks.jwt({token:{...recent,accountCheckedAt:0}}),null)
  const request=(route,auth=null)=>({url:'https://ahawc.com'+route,nextUrl:new URL('https://ahawc.com'+route),auth,cookies:jar(null)})
  const signedOut=await api.proxy(request('/field?invoice=123'))
  assert.equal(signedOut.url,'https://ahawc.com/login?next=%2Ffield%3Finvoice%3D123')
  assert.deepEqual(signedOut.savedCookies[0],[api.FIELD_DEVICE_COOKIE,'1',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:30*24*60*60}])
  // A preference cookie grants no authentication; the signed-out field route redirects.
  const cookieOnly=request('/field');cookieOnly.cookies=jar('1')
  assert.equal((await api.proxy(cookieOnly)).kind,'redirect')
  const signedIn={user:{role:'staff',roles:['staff']}}
  assert.equal((await api.proxy(request('/login?next=%2Ffield%3Finvoice%3D123',signedIn))).url,'https://ahawc.com/field?invoice=123')
  assert.equal((await api.proxy(request('/login',signedIn))).url,'https://ahawc.com/staff')
  assert.equal((await api.proxy(request('/login'))).savedCookies.length,0)
  await fs.unlink(out)
})
