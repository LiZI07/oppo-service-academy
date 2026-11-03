// Exercises real cookie authentication AND business APIs on workerd + D1.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {randomBytes,scryptSync} from 'node:crypto';
const require=createRequire(import.meta.resolve('wrangler'));
const {Miniflare}=require('miniflare'),{build}=require('esbuild');
const roles=['admin','trainee','trainer','store_manager','regional_supervisor','leader','vpc'];
const accounts=roles.map(role=>({id:role,email:role+'@academy.example.test',role,name:'TEST '+role,store:'TEST-A',password:randomBytes(18).toString('base64url')}));
function hash(password){const salt=randomBytes(16).toString('hex');return 'scrypt:32768:8:3:'+salt+':'+scryptSync(password,salt,32,{N:32768,r:8,p:3,maxmem:48*1024*1024}).toString('hex')}
const fixture=accounts.map(({password,...m})=>({...m,hash:hash(password)}));
const entry=`import {storage} from 'test:context';
import {privateGateway} from './worker/private-gateway';
import * as training from './app/api/training/route';
import * as password from './app/api/password/route';
import * as session from './app/api/session/route';
import * as operations from './app/api/operations/route';
export default {async fetch(req,env){return storage.run(req,async()=>{
const denied=await privateGateway(req,env);if(denied)return denied;
const path=new URL(req.url).pathname;
const route={'/api/training':training,'/api/password':password,'/api/session':session,'/api/operations':operations}[path];
return route?.[req.method]?route[req.method](req):new Response('private application');
})}};`;
const bundled=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'neutral',format:'esm',external:['node:crypto','node:async_hooks','cloudflare:workers'],plugins:[{name:'request-headers',setup(b){
 b.onResolve({filter:/^test:context$/},()=>({path:'context',namespace:'test'}));
 b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'test'}));
 b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'test'}));
 b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:a.path==='context'?`import {AsyncLocalStorage} from 'node:async_hooks';export const storage=new AsyncLocalStorage();`:a.path==='headers'?`import {storage} from 'test:context';export async function headers(){return storage.getStore().headers}`:`export function redirect(url){throw new Error(url)}`,loader:'js'}));
}}]});
const mf=new Miniflare({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{AUTH_PROVIDER:'password'}});
try{
 const db=await mf.getD1Database('DB');
 for(const file of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const sql of fs.readFileSync('drizzle/'+file,'utf8').split(';').filter(s=>s.trim()))await db.prepare(sql).run();
 for(const m of fixture){await db.prepare('INSERT INTO members(id,email,name,role,store,trainer,hire,active) VALUES(?,?,?,?,?,?,?,1)').bind(m.id,m.email,m.name,m.role,m.store,m.role==='trainee'?'trainer':null,'2026-11-01').run();await db.prepare('INSERT INTO academy_credentials(member_id,password_hash,updated) VALUES(?,?,?)').bind(m.id,m.hash,new Date().toISOString()).run()}
 await db.prepare("INSERT INTO members(id,email,name,role,store,active) VALUES('outsider','outsider@academy.example.test','Outside store','trainee','TEST-B',1)").run();
 for(const role of ['store_manager','regional_supervisor','leader','vpc'])await db.prepare("INSERT INTO documents(id,kind,owner,data,revision,updated) VALUES(?,'rights',?,?,1,?)").bind('rights:'+role,role,JSON.stringify({stages:role==='vpc'?['lv1']:[],scope:{mode:'assigned',stores:['TEST-A'],trainees:[]}}),new Date().toISOString()).run();
 const send=(path,{cookie,body,method,...other}={})=>mf.dispatchFetch('https://academy.test'+path,{redirect:'manual',method:method||(body?'POST':'GET'),headers:{origin:'https://academy.test','content-type':'application/json',...(cookie?{cookie}:{}),...other},...(body?{body:JSON.stringify(body)}:{})});
 const data=async r=>({status:r.status,...await r.json()});
 async function login(m){const r=await send('/api/auth/login',{body:{email:m.email.toUpperCase(),password:m.password}});assert.equal(r.status,200,await r.clone().text());return r.headers.get('set-cookie').split(';')[0]}
 assert.equal((await send('/')).status,303);assert.equal((await send('/api/training')).status,401);assert.equal((await send('/public/internal.pdf')).status,303);
 const adminCookie=await login(accounts[0]);
 assert.equal((await data(await send('/api/training',{cookie:adminCookie}))).me.role,'admin');
 for(const m of accounts){const cookie=await login(m),d=await data(await send('/api/training?role=admin',{cookie}));assert.equal(d.status,200,JSON.stringify(d));assert.equal(d.me.role,m.role);assert(d.members.every(x=>m.role==='admin'||x.id!=='outsider'));
  if(m.role!=='admin'){
   assert.equal((await send('/api/operations',{cookie})).status,403);
   assert.equal((await send('/api/training?user=outsider',{cookie})).status,403);
   assert.equal((await send('/api/training',{cookie,body:{action:'memberImport',data:{members:[{name:'Elevate',email:'hack@example.test',role:'admin'}]}}})).status,403);
   assert.equal((await send('/api/password',{cookie,body:{action:'resetLinks',memberIds:['admin'],currentPassword:m.password}})).status,403);
  }
  const out=await send('/api/auth/logout',{cookie,method:'POST'});assert.equal(out.status,303);assert(out.headers.get('set-cookie').includes('Max-Age=0'));
  assert.equal((await send('/api/training',{cookie})).status,401);
 }
 // 50-account onboarding, including a forward reference to the trainer in row 50.
 const rows=Array.from({length:50},(_,i)=>({name:'Batch '+i,email:`batch${i}@example.test`,role:i===49?'trainer':'trainee',store:'BATCH',hire:'2026-11-01',trainer_email:i===49?'':'batch49@example.test'}));
 const imported=await data(await send('/api/training',{cookie:adminCookie,body:{action:'memberImport',data:{members:rows}}}));assert.equal(imported.status,200,JSON.stringify(imported));assert.equal(imported.result.created,50);const ids=imported.result.members.map(m=>m.id);
 const totalBefore=(await db.prepare('SELECT count(*) AS n FROM members').first()).n;
 assert.equal((await send('/api/training',{cookie:adminCookie,body:{action:'memberImport',data:{members:[{...rows[0],email:'new@example.test'},rows[1]]}}})).status,400);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM members').first()).n,totalBefore,'Invalid import rolls back all rows');
 const adminPassword=accounts[0].password;
 assert.equal((await send('/api/password',{cookie:adminCookie,body:{action:'resetLinks',memberIds:ids,currentPassword:'wrong'}})).status,403);
 const reset=await data(await send('/api/password',{cookie:adminCookie,body:{action:'resetLinks',memberIds:ids,currentPassword:adminPassword}}));assert.equal(reset.status,200,JSON.stringify(reset));assert.equal(reset.links.length,50);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM academy_reset_tokens').first()).n,50);
 const first=reset.links[0],raw=new URLSearchParams(new URL(first.url).hash.slice(1)).get('reset');
 assert(!(await db.prepare('SELECT token_hash FROM academy_reset_tokens WHERE member_id=?').bind(first.id).first()).token_hash.includes(raw));
 const initialPassword=randomBytes(18).toString('base64url');
 assert.equal((await send('/api/auth/reset',{body:{token:raw,password:initialPassword}})).status,200);
 assert.equal((await send('/api/auth/reset',{body:{token:raw,password:initialPassword}})).status,400);
 const fresh=await login({email:first.email,password:initialPassword});assert.equal((await data(await send('/api/training',{cookie:fresh}))).me.email,first.email);
 // Locking then unlocking must never restore an old session or reset link.
 const member=(await data(await send('/api/training',{cookie:adminCookie}))).members.find(m=>m.id===first.id);
 assert.equal((await send('/api/training',{cookie:adminCookie,body:{action:'member',data:{...member,active:false}}})).status,200);
 assert.equal((await send('/api/training',{cookie:fresh})).status,401);
 assert.equal((await send('/api/training',{cookie:adminCookie,body:{action:'member',data:{...member,active:true}}})).status,200);
 assert.equal((await send('/api/training',{cookie:fresh})).status,401);
 console.log('PASS: real workerd/D1 email-password login and logout for all 7 roles; scoped APIs; Admin-only account and password operations; blocked anonymous assets; atomic 50-account import with forward Trainer references; 50 hashed one-use setup links; replay prevention; disabled-account session revocation after re-enable.');
}finally{await mf.dispose()}
