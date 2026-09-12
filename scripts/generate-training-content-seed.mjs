import {readFileSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';
import {publishedActivityRows,validateActivityVersion} from '../lib/training-content.mjs';

const input=process.argv[2];
if(!input){console.error('Usage: node scripts/generate-training-content-seed.mjs <reviewed-content.json>');process.exit(2);}
const path=isAbsolute(input)?input:resolve(process.cwd(),input);

try{
 const parsed=JSON.parse(readFileSync(path,'utf8'));
 if(!Array.isArray(parsed))throw new Error('Reviewed content input must be a JSON array.');
 parsed.forEach(validateActivityVersion);
 const rows=publishedActivityRows(parsed);const quote=value=>`'${String(value).replaceAll("'","''")}'`;const nullable=value=>value==null?'NULL':quote(value);
 const families=[...new Map(rows.map(row=>[row.familyId,parsed.find(item=>item.familyId===row.familyId)?.name||row.familyId])).entries()];
 const sql=['BEGIN;'];
 for(const [familyId,name] of families)sql.push(`INSERT INTO \`activity_families\` (\`family_id\`,\`name\`,\`created_at\`) VALUES (${quote(familyId)},${quote(name)},${quote(new Date(0).toISOString())}) ON CONFLICT(\`family_id\`) DO NOTHING;`);
 for(const row of rows)sql.push(`INSERT INTO \`activity_versions\` (\`activity_id\`,\`version\`,\`family_id\`,\`payload_json\`,\`content_status\`,\`development_reviewer_id\`,\`development_reviewed_at\`,\`safety_reviewer_id\`,\`safety_reviewed_at\`,\`published_at\`,\`retired_at\`,\`retirement_reason\`,\`created_at\`) VALUES (${quote(row.activityId)},${row.version},${quote(row.familyId)},${quote(row.payloadJson)},${quote(row.contentStatus)},${quote(row.developmentReviewerId)},${quote(row.developmentReviewedAt)},${quote(row.safetyReviewerId)},${quote(row.safetyReviewedAt)},${quote(row.publishedAt)},${nullable(row.retiredAt)},${nullable(row.retirementReason)},${quote(row.publishedAt)}) ON CONFLICT(\`activity_id\`,\`version\`) DO NOTHING;`);
 sql.push('COMMIT;');process.stdout.write(`${sql.join('\n')}\n`);
}catch(error){console.error(error instanceof Error?error.message:'Training content seed failed.');process.exit(1);}
