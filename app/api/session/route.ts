import {getChatGPTUser} from '../../chatgpt-auth';
import {identity,json} from '../../lib/server';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await getChatGPTUser();if(!user)return json({signedIn:false,user:null,account:null});let account=null,error=null;try{const m=await identity();account={id:m.id,name:m.name,email:m.email,role:m.role,store:m.store,active:!!m.active}}catch(e:any){error=e.message}return json({signedIn:true,user:{name:user.displayName,email:user.email},account,error})}catch{return json({error:'SESSION_UNAVAILABLE'},503)}}
