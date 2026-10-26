import {db,doc,rows,write,fail,now} from './server';
import {canSee,stageCan,examCan} from './policy.mjs';
export const examStages=['week1','month1','lv1','practical','kpi30','kpi45','kpi90','follow90'];
export const examId=(trainee:string,stage:string)=>'exam:'+trainee+':'+stage;
export async function hydrateMember(m:any){const r=await doc('rights:'+m.id);return {...m,rights:r?.data||{stages:[]},courseRights:Object.fromEntries((await rows('courseAcl')).flatMap((a:any)=>{const g=a.data.grants?.find((g:any)=>g.memberId===m.id);return g?[[a.data.course,g]]:[]}))}}
export async function assignExam(actor:any,target:any,data:any,revision?:number){
 if(actor.role!=='admin')fail('ADMIN_REQUIRED',403);if(target.role!=='trainee'||!target.active)fail('SELECT_TRAINEE');
 if(!examStages.includes(data.stage)||typeof data.assessorId!=='string'||typeof data.note!=='string'||data.note.length>2000||typeof data.dueDate!=='string'||data.dueDate&&!/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate))fail('INVALID_EXAM_ASSIGNMENT');
 if(data.dueDate&&(!Number.isFinite(Date.parse(data.dueDate))||new Date(data.dueDate).toISOString().slice(0,10)!==data.dueDate))fail('INVALID_EXAM_ASSIGNMENT');
 const old=await doc(examId(target.id,data.stage));if(old&&old.data.assessorId!==data.assessorId&&!data.note.trim())fail('ASSIGNMENT_REASON_REQUIRED');
 if(data.assessorId){const m:any=await db().prepare('SELECT * FROM members WHERE id=?').bind(data.assessorId).first();if(!m?.active||m.role==='trainee')fail('INVALID_ASSESSOR');const a=await hydrateMember(m);if(!canSee(a,target)||!stageCan(a,data.stage))fail('ASSESSOR_NOT_ELIGIBLE',403)}
 return write(actor,examId(target.id,data.stage),'examAssignment',target.id,{stage:data.stage,assessorId:data.assessorId,dueDate:data.dueDate,note:data.note,assignedBy:actor.id,assignedByName:actor.name,assignedAt:now(),history:old?[...(old.data.history||[]),{...old.data,history:undefined}]:[]},revision);
}
export async function requireExamAssessor(actor:any,target:any,stage:string,revision:any){
 const assignment=await doc(examId(target.id,stage));if(!assignment?.data.assessorId)fail('EXAM_NOT_ASSIGNED',403);if(!examCan(actor,target,stage,assignment))fail('EXAM_VIEW_ONLY',403);if(revision!==assignment.revision)fail('EXAM_ASSIGNMENT_CHANGED',409);
 return {id:assignment.id,revision:assignment.revision,assessorId:actor.id};
}
