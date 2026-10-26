import {db} from './server';
import {canSee,visibleRecord,courseCan,confirmation,resultFeed} from './policy.mjs';
export function summarizeTeam(me:any,members:any[],courses:any[],records:any[],today=new Date(Date.now()+7*3600000).toISOString().slice(0,10)){
 const curriculum=courses.filter(c=>c.data.published&&!c.data.archived&&(me.role!=='vpc'||courseCan(me,c.id,'assess')));
 return members.filter(m=>m.role==='trainee'&&canSee(me,m)).map(m=>{
  const docs=records.filter(r=>r.owner===m.id&&visibleRecord(me,m,r)),progress=docs.filter(r=>r.kind==='progress'&&curriculum.some(c=>c.id===r.data.course)),completedIds=new Set(progress.map(r=>r.data.course)),journals=docs.filter(r=>r.kind==='journal'),assess=(type:string)=>docs.find(r=>r.kind==='assessment'&&r.data.type===type&&r.data.status==='final'),kpi=docs.find(r=>r.kind==='kpi'&&r.data.stage===45&&r.data.status==='final');
  const day=m.hire?Math.floor((Date.parse(today)-Date.parse(m.hire))/86400000)+1:null,last=progress.slice().sort((a,b)=>b.updated.localeCompare(a.updated))[0],next=curriculum.find(c=>!completedIds.has(c.id)),timer=docs.find(r=>r.kind==='timer');
  return {id:m.id,name:m.name,store:m.store,trainer:m.trainer,hire:m.hire,active:m.active,day,completed:completedIds.size,total:curriculum.length,pct:curriculum.length?Math.round(completedIds.size/curriculum.length*100):null,reviewed:docs.filter(r=>r.kind==='courseAssessment'&&r.data.status==='final'&&r.data.result==='passed'&&curriculum.some(c=>c.id===r.data.course)).length,pending:journals.filter(r=>r.data.status==='pending').length,returned:journals.filter(r=>r.data.status==='returned').length,devices:journals.filter(r=>r.data.status==='approved').reduce((n,r)=>n+(r.data.count||0),0),minutes:timer?Math.floor((timer.data.seconds||0)/60):me.role==='vpc'?null:0,lastCourseId:last?.data.course||null,lastStudyAt:last?.data.completedAt||null,nextCourseId:next?.id||null,overdue:day===null?0:curriculum.filter(c=>c.data.end<day&&!completedIds.has(c.id)).length,remedial:docs.filter(r=>r.kind==='remedial'&&r.data.status!=='closed').length,confirmation:confirmation(assess('lv1')?.data.score??null,kpi?.data.evaluation?.result??null,assess('practical')?.data.score??null),milestones:['week1','month1','lv1','practical','follow90'].filter(type=>!!assess(type)),scope:me.role==='vpc'?'assignedCourses':'program'};
 });
}
export async function teamOverview(me:any,members:any[],courses:any[]){
 const ids=members.filter(m=>m.role==='trainee'&&canSee(me,m)).map(m=>m.id);const records:any[]=[];
 // Read only operational records; never load or return personal notes in the team overview.
 for(let n=0;n<ids.length;n+=60){const part=ids.slice(n,n+60);const r=await db().prepare(`SELECT id,kind,owner,data,revision,updated FROM documents WHERE owner IN (${part.map(()=>'?').join(',')}) AND kind IN ('progress','journal','assessment','courseAssessment','kpi','remedial','timer')`).bind(...part).all();records.push(...r.results.map((r:any)=>({...r,data:JSON.parse(r.data)})))}
 return {team:summarizeTeam(me,members,courses,records),resultFeed:resultFeed(me,members,records)};
}
