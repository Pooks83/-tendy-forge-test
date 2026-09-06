import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {Miniflare} from 'miniflare';

test('built worker renders training and isolates durable profiles and coach permissions',async()=>{
 const mf=new Miniflare({modules:true,scriptPath:new URL('../dist/server/index.js',import.meta.url).pathname,modulesRules:[{type:'ESModule',include:['**/*.js','**/*.mjs'],fallthrough:true}],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB']});
 try {
  const db=await mf.getD1Database('DB');
  const sql=await readFile(new URL('../drizzle/0000_slow_hellion.sql',import.meta.url),'utf8');
  for(const statement of sql.split('--> statement-breakpoint'))if(statement.trim())await db.prepare(statement.trim()).run();
  const call=async(user,body,origin='http://localhost')=>{
   const headers={...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test'}:{}),...(body?{'Content-Type':'application/json',Origin:origin}:{})};
   const r=await mf.dispatchFetch('http://localhost/api/training',{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{})});
   return {status:r.status,data:await r.json()};
  };
  const page=await mf.dispatchFetch('http://localhost/',{headers:{accept:'text/html'}});
  assert.equal(page.status,200);const html=await page.text();
  assert.match(html,/aria-label="Main navigation"/);
  assert.match(html,/id="training-main"/);
  assert.match(html,/<meta(?=[^>]*name="codex-preview")(?=[^>]*content="development")/);
  assert.match(html,/<meta(?=[^>]*name="viewport")(?=[^>]*width=device-width)(?=[^>]*viewport-fit=cover)/);
  assert.equal((await call(null)).status,401);
  assert.equal((await call('owner',{type:'create'},'http://evil.test')).status,403);
  const created=await call('owner',{type:'create',nickname:'Test goalie',team:'Test team',ageBand:'10–12',adultConfirmed:true});
  assert.equal(created.status,201);const profileId=created.data.id;
  assert.equal((await call('other')).data.profiles.length,0);
  assert.equal((await call('other',{type:'export',profileId})).status,404);
  assert.equal((await call('owner',{type:'action',profileId,revision:0,action:{type:'set',drillId:'warm',setIndex:0}})).status,200);
  const saved=await call('owner');assert.equal(saved.data.profiles[0].state.sets['foundation:0:0:warm:0'],true);
  assert.equal((await call('owner',{type:'action',profileId,revision:0,action:{type:'stop'}})).status,409);
  assert.equal((await call('owner',{type:'share',profileId,email:'coach@example.test'})).status,200);
  assert.equal((await call('coach')).data.profiles[0].role,'coach');
  assert.equal((await call('coach',{type:'action',profileId,revision:1,action:{type:'set',drillId:'warm',setIndex:1}})).status,403);
  assert.equal((await call('coach',{type:'delete',profileId})).status,403);
  assert.equal((await call('coach',{type:'action',profileId,revision:1,action:{type:'check',passed:true,note:'Specific but missing a skill.'}})).status,400);
  assert.equal((await call('coach',{type:'action',profileId,revision:1,action:{type:'check',skillId:1,passed:true,note:'Five of six steps ended balanced.'}})).status,200);
  assert.equal((await call('coach',{type:'action',profileId,revision:2,action:{type:'evaluate',ratings:Array(10).fill(2),cause:'tracking',note:'Tracked eight of ten catches into the hands.'}})).status,200);
  assert.equal((await call('owner',{type:'revoke',profileId,email:'coach@example.test'})).status,200);
  assert.equal((await call('coach')).data.profiles.length,0);
  assert.equal((await call('coach',{type:'export',profileId})).status,404);
  const exported=(await call('owner',{type:'export',profileId})).data.training;
  assert.equal(exported.checks.length,1);
  assert.equal(exported.evaluations.length,1);
  assert.equal((await call('owner',{type:'delete',profileId})).status,200);
  assert.equal((await call('owner')).data.profiles.length,0);
 } finally {await mf.dispose();}
});
