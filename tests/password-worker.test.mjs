// Integration check against the actual workerd + D1 runtime, not a Node-only crypto mock.
import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.resolve('wrangler'));const {Miniflare}=require('miniflare'),{build}=require('esbuild');
const bundled=await build({stdin:{contents:`import {privateGateway} from './worker/private-gateway';import {passwordHash} from './app/lib/password-auth';export default {async fetch(request,env){if(new URL(request.url).pathname==='/fixture'){await env.DB.prepare('INSERT INTO members(id,auth_id,email,name,role,active) VALUES(?,?,?,?,?,1)').bind('owner','cf-access:original','owner@example.test','Owner','admin').run();await env.DB.prepare('INSERT INTO academy_credentials(member_id,password_hash,updated) VALUES(?,?,?)').bind('owner',await passwordHash('Local-only integration test phrase!'),new Date().toISOString()).run();return new Response('ready')}return await privateGateway(request,env)||new Response('private app')}}`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'neutral',format:'esm',external:['node:crypto']});
const mf=new Miniflare({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{AUTH_PROVIDER:'password'}});
try{
 const db=await mf.getD1Database('DB');for(const file of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const sql of fs.readFileSync('drizzle/'+file,'utf8').split(';').filter(s=>s.trim()))await db.prepare(sql).run();
 const send=(path,init={})=>mf.dispatchFetch('https://local.test'+path,{redirect:'manual',...init});
 assert.equal((await send('/login')).status,200);assert.equal((await send('/api/training')).status,401);assert.equal((await send('/fixture')).status,200);
 let response=await send('/api/auth/login',{method:'POST',headers:{origin:'https://local.test','content-type':'application/json'},body:JSON.stringify({email:'owner@example.test',password:'Local-only integration test phrase!',remember:true})});assert.equal(response.status,200,await response.clone().text());const cookie=response.headers.get('set-cookie').split(';')[0];
 assert.equal(await(await send('/',{headers:{cookie}})).text(),'private app');
 response=await send('/api/auth/logout',{method:'POST',headers:{origin:'https://local.test',cookie}});assert.equal(response.status,303);assert.equal((await send('/api/training',{headers:{cookie}})).status,401);
 console.log('PASS: real workerd scrypt + D1 migrations, password sign-in, secure session lookup, private gateway and session revocation.');
}finally{await mf.dispose()}
