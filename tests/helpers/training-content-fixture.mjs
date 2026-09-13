import {candidateActivityVersions,publishedActivityRows} from '../../lib/training-content.mjs';

const review=item=>({...item,developmentAttributeIds:['BALANCE'],contentStatus:'PUBLISHED',developmentReview:{reviewerId:'development-fixture',reviewedAt:'2026-09-12T00:00:00.000Z'},safetyReview:{reviewerId:'safety-fixture',reviewedAt:'2026-09-12T00:00:00.000Z'},publishedAt:'2026-09-12T00:00:00.000Z'});

export async function seedPublishedContent(db,items=candidateActivityVersions){
 const approved=items.map(review);const rows=publishedActivityRows(approved);const now='2026-09-12T00:00:00.000Z';
 for(const item of approved)await db.prepare('INSERT OR IGNORE INTO activity_families(family_id,name,created_at) VALUES(?,?,?)').bind(item.familyId,item.name,now).run();
 for(const row of rows)await db.prepare('INSERT INTO activity_versions(activity_id,version,family_id,payload_json,content_status,development_reviewer_id,development_reviewed_at,safety_reviewer_id,safety_reviewed_at,published_at,retired_at,retirement_reason,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(row.activityId,row.version,row.familyId,row.payloadJson,row.contentStatus,row.developmentReviewerId,row.developmentReviewedAt,row.safetyReviewerId,row.safetyReviewedAt,row.publishedAt,row.retiredAt,row.retirementReason,now).run();
 return approved;
}
