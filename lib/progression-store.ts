import type {AdultIdentity} from './account-identity';
import {getActivePlayer} from './household-store';
import {CANONICAL_DEVELOPMENT_ATTRIBUTES,PROGRESSION_RULE_VERSION} from './progression.mjs';

type PlayerProjection={profile:{id:string};training:{pathId:string;week:number;day:number;cycle?:number}};
type TotalRow={total:number|null};
type AttributeRow={attribute_id:string;total:number};
type RewardRow={reward_id:string;awarded_at:string};
type CompletionRow={mission_key:string;completed_at:string;completed_prescribed_minutes:number;skipped_prescribed_minutes:number;xp:number;rule_version:string};

export const PROGRESSION_MEANING='Development work only — not a goalie ability or game-performance score.';

export async function getProgressProjection(db:D1Database,identity:AdultIdentity){
 const player=await getActivePlayer(db,identity) as unknown as PlayerProjection;const profileId=player.profile.id;
 const total=await db.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM xp_ledger WHERE profile_id=?').bind(profileId).first<TotalRow>();
 const attributeRows=(await db.prepare('SELECT attribute_id,SUM(amount_units) AS total FROM attribute_progress_ledger WHERE profile_id=? GROUP BY attribute_id ORDER BY attribute_id').bind(profileId).all<AttributeRow>()).results;
 const storedAttributes=new Map(attributeRows.map(row=>[row.attribute_id,row.total]));
 const attributes=Object.fromEntries(CANONICAL_DEVELOPMENT_ATTRIBUTES.map((id:string)=>[id,(storedAttributes.get(id)||0)/1000]));
 const rewardRows=(await db.prepare('SELECT reward_id,awarded_at FROM reward_entitlements WHERE profile_id=? ORDER BY awarded_at,reward_id').bind(profileId).all<RewardRow>()).results;
 const completionRows=(await db.prepare('SELECT m.mission_key,c.completed_at,c.completed_prescribed_minutes,c.skipped_prescribed_minutes,c.xp,c.rule_version FROM mission_completion_ledger c JOIN mission_instances m ON m.id=c.mission_instance_id WHERE c.profile_id=? ORDER BY c.completed_at DESC,c.id DESC LIMIT 20').bind(profileId).all<CompletionRow>()).results;
 return {
  profileContextId:profileId,ruleVersion:PROGRESSION_RULE_VERSION,totalXp:Number(total?.total||0),attributes,
  journey:{pathId:player.training.pathId,week:player.training.week,day:player.training.day,cycle:player.training.cycle||0},
  rewards:rewardRows.map(row=>({id:row.reward_id,awardedAt:row.awarded_at})),
  recentCompletions:completionRows.map(row=>({missionId:row.mission_key,completedAt:row.completed_at,completedPrescribedMinutes:row.completed_prescribed_minutes,skippedPrescribedMinutes:row.skipped_prescribed_minutes,xp:row.xp,ruleVersion:row.rule_version})),
  meaning:PROGRESSION_MEANING,
 };
}
