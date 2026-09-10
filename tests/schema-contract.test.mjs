import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

function migratedDatabase(){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON');
 for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(name=>/^\d+.*\.sql$/.test(name)).sort()){
  const sql=readFileSync(new URL(`../drizzle/${file}`,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',';');
  db.exec(sql);
 }
 return db;
}

test('identity migration creates every canonical TF-MVP-003 table',()=>{
 const db=migratedDatabase();
 const tables=db.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all().map(row=>row.name);
 for(const name of ['active_player_context','audit_events','consent_records','deletion_requests','guardian_player','idempotency_records','privacy_preferences'])assert.ok(tables.includes(name),`${name} missing`);
});

test('identity migration adds setup fields without changing legacy training state',()=>{
 const db=migratedDatabase();
 const columns=db.prepare("PRAGMA table_info('training_profiles')").all().map(row=>row.name);
 for(const name of ['catches','experience','equipment_json','planned_days_json','mission_minutes','setup_status','updated_at'])assert.ok(columns.includes(name),`${name} missing`);
 assert.ok(columns.includes('state'));
});

test('guardian, active-context, and idempotency keys prevent duplicate relationships and mutations',()=>{
 const db=migratedDatabase();
 db.prepare("INSERT INTO training_profiles(id,owner_id,nickname,team,age_band,state,created_at) VALUES(?,?,?,?,?,?,?)").run('p1','a1','Goalie','','8–10','{}','2026-09-10T00:00:00Z');
 db.prepare("INSERT INTO guardian_player(account_id,profile_id,relationship,status,created_at) VALUES(?,?,?,?,?)").run('a1','p1','guardian','active','2026-09-10T00:00:00Z');
 assert.throws(()=>db.prepare("INSERT INTO guardian_player(account_id,profile_id,relationship,status,created_at) VALUES(?,?,?,?,?)").run('a1','p1','guardian','active','2026-09-10T00:00:00Z'),/UNIQUE|constraint/i);
 db.prepare("INSERT INTO active_player_context(account_id,profile_id,updated_at) VALUES(?,?,?)").run('a1','p1','2026-09-10T00:00:00Z');
 assert.throws(()=>db.prepare("INSERT INTO active_player_context(account_id,profile_id,updated_at) VALUES(?,?,?)").run('a1','p1','2026-09-10T00:00:00Z'),/UNIQUE|constraint/i);
 db.prepare("INSERT INTO idempotency_records(account_id,operation_key,operation,response_json,created_at) VALUES(?,?,?,?,?)").run('a1','op1','onboarding','{}','2026-09-10T00:00:00Z');
 assert.throws(()=>db.prepare("INSERT INTO idempotency_records(account_id,operation_key,operation,response_json,created_at) VALUES(?,?,?,?,?)").run('a1','op1','onboarding','{}','2026-09-10T00:00:00Z'),/UNIQUE|constraint/i);
});

test('required relationship queries use declared indexes',()=>{
 const db=migratedDatabase();
 const guardianPlan=db.prepare("EXPLAIN QUERY PLAN SELECT profile_id FROM guardian_player WHERE account_id=? AND status='active'").all('a1').map(row=>row.detail).join(' ');
 const consentPlan=db.prepare('EXPLAIN QUERY PLAN SELECT * FROM consent_records WHERE profile_id=? ORDER BY accepted_at DESC').all('p1').map(row=>row.detail).join(' ');
 const auditPlan=db.prepare('EXPLAIN QUERY PLAN SELECT * FROM audit_events WHERE profile_id=? ORDER BY created_at DESC').all('p1').map(row=>row.detail).join(' ');
 assert.match(guardianPlan,/idx_guardian_player_account/);
 assert.match(consentPlan,/idx_consent_records_profile/);
 assert.match(auditPlan,/idx_audit_events_profile_created/);
});
