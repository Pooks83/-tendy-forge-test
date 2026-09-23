import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare} from 'miniflare';

async function setup(){
 const mf=new Miniflare({modules:true,scriptPath:new URL('../dist/server/index.js',import.meta.url).pathname,modulesRules:[{type:'ESModule',include:['**/*.js','**/*.mjs'],fallthrough:true}],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB']});
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir(new URL('../drizzle/',import.meta.url))).filter(name=>/^\d+.*\.sql$/.test(name)).sort()){
  const sql=await readFile(new URL(`../drizzle/${file}`,import.meta.url),'utf8');
  for(const statement of sql.split('--> statement-breakpoint'))if(statement.trim())await db.prepare(statement.trim()).run();
 }
 return {mf,db};
}
const auth=id=>({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
const post=async(mf,id,body,key='measure-1')=>{const response=await mf.dispatchFetch('http://localhost/api/measurements',{method:'POST',headers:{...auth(id),'content-type':'application/json','idempotency-key':key,origin:'http://localhost'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
const get=async(mf,id)=>{const response=await mf.dispatchFetch('http://localhost/api/measurements',{headers:auth(id)});return {status:response.status,data:await response.json()};};

async function player(db,id='p1',account='parent'){
 const at='2026-09-23T12:00:00.000Z';
 await db.prepare('INSERT INTO training_profiles(id,owner_id,nickname,team,age_band,state,created_at,setup_status,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,account,'Goalie','','10–12','{}',at,'ready',at).run();
 await db.prepare('INSERT INTO guardian_player(account_id,profile_id,relationship,status,created_at) VALUES(?,?,?,?,?)').bind(account,id,'guardian','active',at).run();
 await db.prepare('INSERT INTO active_player_context(account_id,profile_id,updated_at) VALUES(?,?,?)').bind(account,id,at).run();
}

test('baseline and retest persist for the active player and produce measured change only',async()=>{
 const {mf,db}=await setup(); try{
  await player(db);
  let r=await post(mf,'parent',{protocolId:'tracking-wall-ball-v1',kind:'BASELINE',value:18},'base-1');
  assert.equal(r.status,201);assert.equal(r.data.measurement.kind,'BASELINE');assert.equal(r.data.comparison,null);
  r=await post(mf,'parent',{protocolId:'tracking-wall-ball-v1',kind:'RETEST',value:23},'retest-1');
  assert.equal(r.status,201);assert.deepEqual(r.data.comparison,{eligible:true,absoluteChange:5,percentChange:27.8,improved:true});
  const projection=await get(mf,'parent');assert.equal(projection.status,200);assert.equal(projection.data.measurements.length,2);assert.deepEqual(projection.data.latestComparison,{eligible:true,absoluteChange:5,percentChange:27.8,improved:true});
  assert.doesNotMatch(JSON.stringify(projection.data),/abilityScore|goalieRating/i);
 }finally{await mf.dispose();}
});

test('measurement endpoint rejects unsupported protocols and is relationship scoped',async()=>{
 const {mf,db}=await setup(); try{
  await player(db);
  const bad=await post(mf,'parent',{protocolId:'made-up',kind:'BASELINE',value:5},'bad-1');assert.equal(bad.status,400);assert.equal(bad.data.error.code,'MEASUREMENT_PROTOCOL_INVALID');
  const outsider=await get(mf,'outsider');assert.equal(outsider.status,409);assert.equal(outsider.data.error.code,'PLAYER_CONTEXT_REQUIRED');
 }finally{await mf.dispose();}
});
