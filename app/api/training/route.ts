import {trainingDb} from '@/lib/training-store';
import {normalizeTrainingState} from '@/lib/training.mjs';
import {applyAction} from '@/lib/training-actions.mjs';
import {getAdultIdentity} from '@/lib/account-identity';
export const dynamic='force-dynamic';
type Row={id:string;owner_id:string;nickname:string;team:string;age_band:string;state:string;revision:number;catches:string|null;experience:string|null;equipment_json:string|null;available_spaces_json:string|null;planned_days_json:string|null;mission_minutes:number|null;setup_status:string;access_role:'owner'|'coach';active:number};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function accessible(id:string,user:{id:string;email:string}) {
 const row=await trainingDb().prepare("SELECT p.*,CASE WHEN EXISTS(SELECT 1 FROM guardian_player gp WHERE gp.profile_id=p.id AND gp.account_id=? AND gp.status='active') THEN 'owner' ELSE 'coach' END AS access_role,0 AS active FROM training_profiles p WHERE p.id=? AND (EXISTS(SELECT 1 FROM guardian_player gp WHERE gp.profile_id=p.id AND gp.account_id=? AND gp.status='active') OR EXISTS (SELECT 1 FROM training_coach_grants g WHERE g.profile_id=p.id AND g.email=?))").bind(user.id,id,user.id,user.email).first<Row>();
 return row;
}
export async function GET() {
 const user=await getAdultIdentity();if(!user)return reply({error:'An adult must sign in to save training.'},401);
 try {
  const db=trainingDb();
  const rows=await db.prepare("SELECT p.*,CASE WHEN EXISTS(SELECT 1 FROM guardian_player gp WHERE gp.profile_id=p.id AND gp.account_id=? AND gp.status='active') THEN 'owner' ELSE 'coach' END AS access_role,CASE WHEN EXISTS(SELECT 1 FROM active_player_context c WHERE c.account_id=? AND c.profile_id=p.id) THEN 1 ELSE 0 END AS active FROM training_profiles p WHERE EXISTS(SELECT 1 FROM guardian_player gp WHERE gp.profile_id=p.id AND gp.account_id=? AND gp.status='active') OR EXISTS (SELECT 1 FROM training_coach_grants g WHERE g.profile_id=p.id AND g.email=?) ORDER BY p.created_at").bind(user.id,user.id,user.id,user.email).all<Row>();
  const profiles=await Promise.all(rows.results.map(async r=>({id:r.id,nickname:r.nickname,team:r.team,ageBand:r.age_band,role:r.access_role,active:Boolean(r.active),revision:r.revision,state:normalizeTrainingState(JSON.parse(r.state)),grants:r.access_role==='owner'?(await db.prepare('SELECT email FROM training_coach_grants WHERE profile_id=?').bind(r.id).all<{email:string}>()).results.map(g=>g.email):[],catches:r.catches,experience:r.experience,equipment:r.equipment_json?JSON.parse(r.equipment_json):[],spaces:r.available_spaces_json?JSON.parse(r.available_spaces_json):[],plannedDays:r.planned_days_json?JSON.parse(r.planned_days_json):[],missionMinutes:r.mission_minutes,setupStatus:r.setup_status})));
  return reply({profiles});
 } catch(e){console.error('Training load failed',e instanceof Error?e.message:'error');return reply({error:'Training could not be loaded. Your saved progress has not been changed.'},503);}
}
export async function POST(request:Request) {
 const user=await getAdultIdentity();if(!user)return reply({error:'An adult must sign in.'},401);
 // All writes require same-origin browser requests and small JSON payloads.
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Request origin rejected'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON required'},415);
 const text=await request.text();if(text.length>12000)return reply({error:'Request too large'},413);
 let input;try{input=JSON.parse(text);}catch{return reply({error:'Invalid request'},400);}
 if(!input||typeof input!=='object'||typeof input.type!=='string')return reply({error:'Invalid request'},400);
 try {
  const db=trainingDb();
  if(input.type==='create') {
   return reply({error:{code:'ONBOARDING_REQUIRED',message:'Use the parent permission and setup flow to add a goalie.'}},410);
  }
  if(typeof input.profileId!=='string')return reply({error:'Choose a profile'},400);
  const row=await accessible(input.profileId,user);if(!row)return reply({error:'Profile unavailable'},404);
  const owner=row.access_role==='owner';
  if(['share','revoke','delete','export'].includes(input.type)) {
   if(!owner)return reply({error:'Parent permission required'},403);
   if(input.type==='export')return reply({nickname:row.nickname,team:row.team,ageBand:row.age_band,training:JSON.parse(row.state)});
   if(input.type==='delete'){await db.batch([db.prepare('DELETE FROM training_coach_grants WHERE profile_id=?').bind(row.id),db.prepare('DELETE FROM training_profiles WHERE id=? AND owner_id=?').bind(row.id,user.id)]);return reply({deleted:true});}
   if(typeof input.email!=='string'||input.email.length>254||!/^\S+@\S+\.\S+$/.test(input.email))return reply({error:'Enter a valid coach email'},400);
   const email=input.email.trim().toLowerCase();
   if(input.type==='share')await db.prepare('INSERT OR IGNORE INTO training_coach_grants (profile_id,email) VALUES (?,?)').bind(row.id,email).run();
   else await db.prepare('DELETE FROM training_coach_grants WHERE profile_id=? AND email=?').bind(row.id,email).run();
   return reply({ok:true});
  }
  if(input.type!=='action'||!Number.isInteger(input.revision)||!input.action)return reply({error:'Invalid action'},400);
  // Authorization rechecked for every request. State is never accepted wholesale from a client.
  if(!owner&&!['check','evaluate'].includes(input.action.type))return reply({error:'Coach permission does not include changing player training'},403);
  const state=applyAction(normalizeTrainingState(JSON.parse(row.state)),input.action,{role:owner?'owner':'coach',id:user.id});
  const result=await db.prepare('UPDATE training_profiles SET state=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(state),row.id,input.revision).run();
  if(!result.meta.changes)return reply({error:'Progress changed on another device. Reload before continuing.'},409);
  return reply({state,revision:input.revision+1});
 } catch(e){const message=e instanceof Error?e.message:'Unable to save';if(/permission|accomplishments|Complete|Finish|Invalid|Unknown|paused|observed|skill|final path/i.test(message))return reply({error:message},400);console.error('Training write failed',message);return reply({error:'Save failed. Your action has not been confirmed. Please retry.'},503);}
}
