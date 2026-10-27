import {scrypt, randomBytes, createHash, timingSafeEqual} from 'node:crypto';

export const SESSION_COOKIE='__Host-academy_session';
const seconds=()=>Math.floor(Date.now()/1000);
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export const token=()=>randomBytes(32).toString('base64url');
export function validPassword(value:unknown):value is string{return typeof value==='string'&&Array.from(value).length>=15&&value.length<=128}
function derive(password:string,salt:string):Promise<Buffer>{return new Promise((resolve,reject)=>scrypt(password,salt,32,{N:32768,r:8,p:3,maxmem:48*1024*1024},(error,key)=>error?reject(error):resolve(key)))}
export async function passwordHash(password:string){const salt=randomBytes(16).toString('hex');return 'scrypt:32768:8:3:'+salt+':'+(await derive(password,salt)).toString('hex')}
export async function passwordMatches(password:string,stored:string){const parts=stored.split(':');if(parts.length!==6||parts.slice(0,4).join(':')!=='scrypt:32768:8:3'||! /^[a-f0-9]{32}$/.test(parts[4])||! /^[a-f0-9]{64}$/.test(parts[5]))return false;const actual=await derive(password,parts[4]);return timingSafeEqual(actual,Buffer.from(parts[5],'hex'))}
export function sessionToken(headers:Headers){const value=headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);return value&&/^[A-Za-z0-9_-]{43}$/.test(value)?value:null}
export function sessionCookie(value:string,maxAge:number,persistent=true){return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax${persistent?'; Max-Age='+maxAge:''}`}
export async function passwordIdentity(headers:Headers,env:Cloudflare.Env){if(!env.DB)return null;const value=sessionToken(headers);if(!value)return null;const m:any=await env.DB.prepare('SELECT m.id,m.auth_id,m.email,m.name FROM academy_sessions s JOIN members m ON m.id=s.member_id JOIN academy_credentials c ON c.member_id=m.id WHERE s.token_hash=? AND s.expires>? AND s.credential_version=c.version AND m.active=1').bind(digest(value),seconds()).first();return m?{userId:m.auth_id||'password:'+m.id,email:m.email,displayName:m.name,fullName:m.name}:null}
export async function authLimit(db:D1Database,key:string,maximum:number){const time=seconds();const row:any=await db.prepare('INSERT INTO academy_auth_limits(key,attempts,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires<=? THEN 1 ELSE attempts+1 END,expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING attempts').bind(key,time+900,time,time).first();return row.attempts<=maximum}
const reply=(body:any,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',...headers}});
export function sameOrigin(request:Request){return request.headers.get('origin')===new URL(request.url).origin&&request.headers.get('sec-fetch-site')!=='cross-site'}
export async function revokeSession(request:Request,env:Cloudflare.Env){const value=sessionToken(request.headers);if(value&&env.DB)await env.DB.prepare('DELETE FROM academy_sessions WHERE token_hash=?').bind(digest(value)).run();return new Response(null,{status:303,headers:{Location:'/login?logged_out=1','Cache-Control':'private, no-store','Set-Cookie':sessionCookie('',0)}})}
export async function authBody(request:Request){
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw Object.assign(Error('INVALID_INPUT'),{status:400});
 const reader=request.body?.getReader();if(!reader)throw Object.assign(Error('INVALID_INPUT'),{status:400});
 const decoder=new TextDecoder();let size=0,text='';
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw Object.assign(Error('INVALID_INPUT'),{status:400})}text+=decoder.decode(value,{stream:true})}text+=decoder.decode();
 try{const b=JSON.parse(text);if(!b||typeof b!=='object'||Array.isArray(b))throw Error();return b}catch{throw Object.assign(Error('INVALID_INPUT'),{status:400})}
}
export async function passwordEndpoint(request:Request,env:Cloudflare.Env){
 if(request.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405);
 if(!sameOrigin(request))return reply({error:'FORBIDDEN_ORIGIN'},403);
 if(!env.DB)return reply({error:'AUTH_UNAVAILABLE'},503);
 const db=env.DB,path=new URL(request.url).pathname;
 if(path==='/api/auth/logout')return revokeSession(request,env);
 let b:any;try{b=await authBody(request)}catch{return reply({error:'INVALID_INPUT'},400)}
 // IP is supplied by Cloudflare ingress, never X-Forwarded-For. Fixed-size hashed keys expire after 15 minutes.
 const ip=request.headers.get('cf-connecting-ip')||'unknown';
 if(!await authLimit(db,'ip:'+digest(ip),30))return reply({error:'TOO_MANY_ATTEMPTS'},429,{'Retry-After':'900'});
 await db.batch([db.prepare('DELETE FROM academy_auth_limits WHERE expires<=?').bind(seconds()),db.prepare('DELETE FROM academy_sessions WHERE expires<=?').bind(seconds()),db.prepare('DELETE FROM academy_reset_tokens WHERE expires<=?').bind(seconds())]);
 if(path==='/api/auth/reset'){
  if(typeof b.token!=='string'||! /^[A-Za-z0-9_-]{43}$/.test(b.token)||!validPassword(b.password))return reply({error:'INVALID_RESET'},400);
  const r:any=await db.prepare('SELECT r.*,m.active FROM academy_reset_tokens r JOIN members m ON m.id=r.member_id WHERE r.token_hash=? AND r.expires>?').bind(digest(b.token),seconds()).first();
  if(!r||!r.active)return reply({error:'INVALID_RESET'},400);
  const hash=await passwordHash(b.password),at=new Date().toISOString();
  // Claim a one-use token and change the credential in the same transaction. A concurrent request cannot reuse it.
  const results=await db.batch([db.prepare('DELETE FROM academy_reset_tokens WHERE token_hash=? AND expires>? AND credential_version=COALESCE((SELECT version FROM academy_credentials WHERE member_id=?),0)').bind(digest(b.token),seconds(),r.member_id),db.prepare('INSERT INTO academy_credentials(member_id,password_hash,version,updated) SELECT ?,?,?,? WHERE changes()=1 ON CONFLICT(member_id) DO UPDATE SET password_hash=excluded.password_hash,version=academy_credentials.version+1,updated=excluded.updated').bind(r.member_id,hash,r.credential_version+1,at),db.prepare('DELETE FROM academy_sessions WHERE member_id=? AND NOT EXISTS(SELECT 1 FROM academy_credentials WHERE member_id=? AND version=?)').bind(r.member_id,r.member_id,r.credential_version)]);
  if(!results[0].meta.changes)return reply({error:'INVALID_RESET'},400);
  await db.prepare('INSERT INTO events(id,actor,subject,action,data,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),r.member_id,r.member_id,'password_reset','{}',at).run();return reply({ok:true});
 }
 if(path!=='/api/auth/login')return reply({error:'NOT_FOUND'},404);
 const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
 if(email.length>150||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof b.password!=='string'||b.password.length>128)return reply({error:'INVALID_CREDENTIALS'},401);
 if(!await authLimit(db,'email:'+digest(email),8))return reply({error:'TOO_MANY_ATTEMPTS'},429,{'Retry-After':'900'});
 const m:any=await db.prepare('SELECT m.*,c.password_hash,c.version FROM members m LEFT JOIN academy_credentials c ON c.member_id=m.id WHERE m.email=?').bind(email).first();
 // Equal work for unregistered, disabled and existing emails; never reveal which accounts exist.
 const dummy='scrypt:32768:8:3:'+'0'.repeat(32)+':'+'0'.repeat(64);
 const matches=await passwordMatches(b.password,m?.password_hash||dummy);
 if(!m?.active||!m.password_hash||!matches)return reply({error:'INVALID_CREDENTIALS'},401);
 const raw=token(),age=b.remember===true?7*86400:12*3600;
 const results=await db.batch([db.prepare('UPDATE members SET auth_id=COALESCE(auth_id,?) WHERE id=? AND active=1').bind('password:'+m.id,m.id),db.prepare('INSERT INTO academy_sessions(token_hash,member_id,credential_version,expires) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM academy_credentials c JOIN members m ON m.id=c.member_id WHERE c.member_id=? AND c.version=? AND m.active=1)').bind(digest(raw),m.id,m.version,seconds()+age,m.id,m.version),db.prepare('INSERT INTO events(id,actor,subject,action,data,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),m.id,m.id,'password_sign_in','{}',new Date().toISOString())]);
 if(!results[1].meta.changes)return reply({error:'INVALID_CREDENTIALS'},401);
 return reply({ok:true},200,{'Set-Cookie':sessionCookie(raw,age,b.remember===true)});
}
