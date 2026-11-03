import {db,fail,now} from './server';
import {roles} from './policy.mjs';
export async function importMembers(actor:any,list:any){
 if(actor.role!=='admin')fail('ADMIN_REQUIRED',403);
 if(!Array.isArray(list)||!list.length||list.length>50)fail('IMPORT_LIMIT');
 const existing=(await db().prepare('SELECT id,email,role,active FROM members').all()).results as any[];
 const seen=new Set<string>();const clean=list.map((r:any,i:number)=>{
  if(!r||typeof r!=='object'||Array.isArray(r))fail('IMPORT_INVALID_ROW_'+(i+2));
  const email=String(r.email||'').trim().toLowerCase(),name=String(r.name||'').trim(),role=String(r.role||'').trim(),store=String(r.store||'').trim(),hire=String(r.hire||'').trim(),trainerEmail=String(r.trainer_email||'').trim().toLowerCase();
  if(!name||name.length>100||email.length>150||!/^\S+@\S+\.\S+$/.test(email)||!roles.includes(role)||store.length>100||!/^$|^\d{4}-\d{2}-\d{2}$/.test(hire)||hire&&!Number.isFinite(Date.parse(hire)))fail('IMPORT_INVALID_ROW_'+(i+2));
  if(seen.has(email)||existing.some(m=>m.email.toLowerCase()===email))fail('IMPORT_EMAIL_EXISTS_ROW_'+(i+2));seen.add(email);
  if(trainerEmail&&role!=='trainee')fail('IMPORT_TRAINER_ROW_'+(i+2));
  return {id:crypto.randomUUID(),name,email,role,store,hire,trainerEmail,trainer:null as string|null};
 });
 for(let i=0;i<clean.length;i++){const r=clean[i];if(r.trainerEmail){const trainer=[...existing,...clean].find(m=>m.email===r.trainerEmail&&m.role==='trainer'&&m.active!==0);if(!trainer)fail('IMPORT_TRAINER_ROW_'+(i+2));r.trainer=trainer.id}}
 // Keep each statement below D1's 100 bound-parameter limit and the complete
 // transaction below the Free plan's per-request query limit, even for 50 rows.
 const at=now(),statements=[];
 for(let i=0;i<clean.length;i+=12){const part=clean.slice(i,i+12);statements.push(db().prepare('INSERT INTO members(id,email,name,role,store,trainer,hire,active) VALUES '+part.map(()=>'(?,?,?,?,?,?,?,1)').join(',')).bind(...part.flatMap(r=>[r.id,r.email,r.name,r.role,r.store,r.trainer,r.hire])))}
 for(let i=0;i<clean.length;i+=16){const part=clean.slice(i,i+16);statements.push(db().prepare('INSERT INTO events(id,actor,subject,action,data,at) VALUES '+part.map(()=>'(?,?,?,?,?,?)').join(',')).bind(...part.flatMap(r=>[crypto.randomUUID(),actor.id,r.id,'memberImport',JSON.stringify({email:r.email,role:r.role,store:r.store,trainer:r.trainer}),at])))}
 await db().batch(statements);
 return {created:clean.length,members:clean.map(({id,name,email,role})=>({id,name,email,role}))};
}
