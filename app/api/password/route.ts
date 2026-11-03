import {env} from 'cloudflare:workers';
import {identity,db,json,checkOrigin,fail} from '../../lib/server';
import {passwordHash,passwordMatches,validPassword,token,digest,authLimit,authBody} from '../../lib/password-auth';
export const dynamic='force-dynamic';
export async function GET(){try{const me=await identity();const credential=await db().prepare('SELECT member_id FROM academy_credentials WHERE member_id=?').bind(me.id).first();return json({hasPassword:!!credential})}catch(e:any){return json({error:e.status?e.message:'AUTH_UNAVAILABLE'},e.status||503)}}
export async function POST(request:Request){try{
 await checkOrigin(request);if(request.headers.get('origin')!==new URL(request.url).origin)fail('FORBIDDEN_ORIGIN',403);
 const me=await identity();if(!await authLimit(db(),'password:'+digest(me.id),8))fail('TOO_MANY_ATTEMPTS',429);
 const b=await authBody(request);
 const current:any=await db().prepare('SELECT * FROM academy_credentials WHERE member_id=?').bind(me.id).first();
 // Current password is required for all credential mutations after initial Access-authenticated setup.
 if(current&&!(typeof b.currentPassword==='string'&&b.currentPassword.length<=128&&await passwordMatches(b.currentPassword,current.password_hash)))fail('CURRENT_PASSWORD_REQUIRED',403);
 if(!current&&env.AUTH_PROVIDER!=='cloudflare-access')fail('PASSWORD_SETUP_REQUIRED',403);
 if(b.action==='resetLinks'){
  if(me.role!=='admin')fail('FORBIDDEN',403);
  if(!Array.isArray(b.memberIds)||!b.memberIds.length||b.memberIds.length>50||b.memberIds.some((id:any)=>typeof id!=='string'||id.length>100)||new Set(b.memberIds).size!==b.memberIds.length)fail('INVALID_MEMBERS');
  const targets=(await db().prepare('SELECT m.id,m.name,m.email,m.role,COALESCE(c.version,0) AS version FROM members m LEFT JOIN academy_credentials c ON c.member_id=m.id WHERE m.active=1 AND m.id IN ('+b.memberIds.map(()=>'?').join(',')+')').bind(...b.memberIds).all()).results as any[];
  if(targets.length!==b.memberIds.length)fail('INVALID_MEMBERS');
  const expires=Math.floor(Date.now()/1000)+1800,at=new Date().toISOString();
  const links=targets.map(m=>({...m,raw:token()}));
  const statements=[db().prepare('DELETE FROM academy_reset_tokens WHERE member_id IN ('+b.memberIds.map(()=>'?').join(',')+')').bind(...b.memberIds)];
  for(let i=0;i<links.length;i+=25){const part=links.slice(i,i+25);statements.push(db().prepare('INSERT INTO academy_reset_tokens(token_hash,member_id,credential_version,expires) VALUES '+part.map(()=>'(?,?,?,?)').join(',')).bind(...part.flatMap(m=>[digest(m.raw),m.id,m.version,expires])))}
  for(let i=0;i<links.length;i+=16){const part=links.slice(i,i+16);statements.push(db().prepare('INSERT INTO events(id,actor,subject,action,data,at) VALUES '+part.map(()=>'(?,?,?,?,?,?)').join(',')).bind(...part.flatMap(m=>[crypto.randomUUID(),me.id,m.id,'password_link_created',JSON.stringify({expires}),at])))}
  await db().batch(statements);
  return json({expires,links:links.map(m=>({id:m.id,name:m.name,email:m.email,role:m.role,url:new URL('/login',request.url).toString()+'#reset='+m.raw}))});
 }
 if(b.action==='resetLink'){
  if(me.role!=='admin')fail('FORBIDDEN',403);
  const target:any=await db().prepare('SELECT id FROM members WHERE id=? AND active=1').bind(String(b.memberId||'')).first();if(!target)fail('NOT_FOUND',404);
  const credential:any=await db().prepare('SELECT version FROM academy_credentials WHERE member_id=?').bind(target.id).first();
  const raw=token(),expires=Math.floor(Date.now()/1000)+1800;
  await db().batch([db().prepare('DELETE FROM academy_reset_tokens WHERE member_id=?').bind(target.id),db().prepare('INSERT INTO academy_reset_tokens(token_hash,member_id,credential_version,expires) VALUES(?,?,?,?)').bind(digest(raw),target.id,credential?.version||0,expires),db().prepare('INSERT INTO events(id,actor,subject,action,data,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),me.id,target.id,'password_link_created',JSON.stringify({expires}),new Date().toISOString())]);
  return json({url:new URL('/login',request.url).toString()+'#reset='+raw,expires});
 }
 if(b.action!=='change'||!validPassword(b.password))fail('PASSWORD_TOO_SHORT');
 const hash=await passwordHash(b.password),at=new Date().toISOString();
 const result=await db().batch([db().prepare('INSERT INTO academy_credentials(member_id,password_hash,version,updated) SELECT ?,?,1,? WHERE NOT EXISTS(SELECT 1 FROM academy_credentials WHERE member_id=?) ON CONFLICT(member_id) DO NOTHING').bind(me.id,hash,at,me.id),db().prepare('UPDATE academy_credentials SET password_hash=?,version=version+1,updated=? WHERE member_id=? AND version=? AND ?=1').bind(hash,at,me.id,current?.version||0,current?1:0),db().prepare('DELETE FROM academy_sessions WHERE member_id=? AND NOT EXISTS(SELECT 1 FROM academy_credentials WHERE member_id=? AND version=?)').bind(me.id,me.id,current?.version||0),db().prepare('DELETE FROM academy_reset_tokens WHERE member_id=?').bind(me.id)]);
 if(!result[0].meta.changes&&!result[1].meta.changes)fail('VERSION_CONFLICT',409);
 await db().prepare('INSERT INTO events(id,actor,subject,action,data,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),me.id,me.id,'password_changed','{}',at).run();return json({ok:true,signInAgain:env.AUTH_PROVIDER==='password'});
 }catch(e:any){return json({error:e.status?e.message:'AUTH_UNAVAILABLE'},e.status||503)}}
