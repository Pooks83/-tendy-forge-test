// Adult-owned player profiles and explicitly granted coach access.
import {sqliteTable,text,integer,index,primaryKey,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const profiles=sqliteTable('training_profiles',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),nickname:text('nickname').notNull(),team:text('team').notNull(),ageBand:text('age_band').notNull(),state:text('state').notNull(),revision:integer('revision').notNull().default(0),createdAt:text('created_at').notNull(),
 catches:text('catches'),experience:text('experience'),equipmentJson:text('equipment_json'),plannedDaysJson:text('planned_days_json'),missionMinutes:integer('mission_minutes'),setupStatus:text('setup_status').notNull().default('legacy-review-required'),updatedAt:text('updated_at'),
},t=>[index('idx_training_profiles_owner').on(t.ownerId)]);
export const grants=sqliteTable('training_coach_grants',{
 profileId:text('profile_id').notNull().references(()=>profiles.id,{onDelete:'cascade'}),email:text('email').notNull(),
},t=>[primaryKey({columns:[t.profileId,t.email]}),index('idx_training_grants_email').on(t.email)]);

export const guardianPlayer=sqliteTable('guardian_player',{
 accountId:text('account_id').notNull(),profileId:text('profile_id').notNull().references(()=>profiles.id,{onDelete:'cascade'}),relationship:text('relationship').notNull().default('guardian'),status:text('status').notNull().default('active'),createdAt:text('created_at').notNull(),revokedAt:text('revoked_at'),
},t=>[primaryKey({columns:[t.accountId,t.profileId]}),index('idx_guardian_player_account').on(t.accountId,t.status),index('idx_guardian_player_profile').on(t.profileId,t.status)]);

export const consentRecords=sqliteTable('consent_records',{
 id:text('id').primaryKey(),accountId:text('account_id').notNull(),profileId:text('profile_id').notNull().references(()=>profiles.id,{onDelete:'cascade'}),consentVersion:text('consent_version').notNull(),purposesJson:text('purposes_json').notNull(),policyVersion:text('policy_version').notNull(),acceptedAt:text('accepted_at').notNull(),revokedAt:text('revoked_at'),
},t=>[index('idx_consent_records_profile').on(t.profileId,t.acceptedAt)]);

export const privacyPreferences=sqliteTable('privacy_preferences',{
 profileId:text('profile_id').primaryKey().references(()=>profiles.id,{onDelete:'cascade'}),analyticsAllowed:integer('analytics_allowed',{mode:'boolean'}).notNull().default(false),notificationsAllowed:integer('notifications_allowed',{mode:'boolean'}).notNull().default(false),clipsAllowed:integer('clips_allowed',{mode:'boolean'}).notNull().default(false),updatedAt:text('updated_at').notNull(),
});

export const activePlayerContext=sqliteTable('active_player_context',{
 accountId:text('account_id').primaryKey(),profileId:text('profile_id').notNull().references(()=>profiles.id,{onDelete:'cascade'}),updatedAt:text('updated_at').notNull(),
});

export const deletionRequests=sqliteTable('deletion_requests',{
 id:text('id').primaryKey(),accountId:text('account_id').notNull(),profileId:text('profile_id').notNull(),status:text('status').notNull(),requestedAt:text('requested_at').notNull(),completedAt:text('completed_at'),
},t=>[index('idx_deletion_requests_account').on(t.accountId,t.requestedAt)]);

export const auditEvents=sqliteTable('audit_events',{
 id:text('id').primaryKey(),actorAccountId:text('actor_account_id').notNull(),profileId:text('profile_id'),eventType:text('event_type').notNull(),metadataJson:text('metadata_json').notNull().default('{}'),createdAt:text('created_at').notNull(),
},t=>[index('idx_audit_events_profile_created').on(t.profileId,t.createdAt)]);

export const idempotencyRecords=sqliteTable('idempotency_records',{
 accountId:text('account_id').notNull(),operationKey:text('operation_key').notNull(),operation:text('operation').notNull(),responseJson:text('response_json').notNull(),createdAt:text('created_at').notNull(),
},t=>[primaryKey({columns:[t.accountId,t.operationKey]})]);

export const onboardingDrafts=sqliteTable('onboarding_drafts',{
 accountId:text('account_id').primaryKey(),step:text('step').notNull(),draftJson:text('draft_json').notNull(),operationKey:text('operation_key').notNull(),consentVersion:text('consent_version').notNull(),policyVersion:text('policy_version').notNull(),permissionAcceptedAt:text('permission_accepted_at').notNull(),updatedAt:text('updated_at').notNull(),
});

export const firstChallengeResults=sqliteTable('first_challenge_results',{
 profileId:text('profile_id').primaryKey().references(()=>profiles.id,{onDelete:'cascade'}),protocolVersion:text('protocol_version').notNull(),status:text('status').notNull(),startedAt:text('started_at').notNull(),completedAt:text('completed_at'),resultJson:text('result_json').notNull().default('{}'),updatedAt:text('updated_at').notNull(),
});

export const productEvents=sqliteTable('product_events',{
 id:text('id').primaryKey(),logicalKey:text('logical_key').notNull(),eventName:text('event_name').notNull(),accountContextId:text('account_context_id'),profileContextId:text('profile_context_id').references(()=>profiles.id,{onDelete:'cascade'}),appVersion:text('app_version').notNull(),buildVersion:text('build_version').notNull(),configVersion:text('config_version').notNull(),metadataJson:text('metadata_json').notNull().default('{}'),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('idx_product_events_logical_key').on(t.logicalKey),index('idx_product_events_name_created').on(t.eventName,t.createdAt)]);

export const missionInstances=sqliteTable('mission_instances',{
 id:text('id').primaryKey(),profileId:text('profile_id').notNull().references(()=>profiles.id,{onDelete:'cascade'}),missionKey:text('mission_key').notNull(),status:text('status').notNull(),startedAt:text('started_at').notNull(),completedAt:text('completed_at'),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('idx_mission_instances_profile_key').on(t.profileId,t.missionKey),index('idx_mission_instances_profile_status').on(t.profileId,t.status)]);
