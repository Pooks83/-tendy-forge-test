// Adult-owned player profiles and explicitly granted coach access.
import {sqliteTable,text,integer,index,primaryKey} from 'drizzle-orm/sqlite-core';
export const profiles=sqliteTable('training_profiles',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),nickname:text('nickname').notNull(),team:text('team').notNull(),ageBand:text('age_band').notNull(),state:text('state').notNull(),revision:integer('revision').notNull().default(0),createdAt:text('created_at').notNull(),
},t=>[index('idx_training_profiles_owner').on(t.ownerId)]);
export const grants=sqliteTable('training_coach_grants',{
 profileId:text('profile_id').notNull().references(()=>profiles.id,{onDelete:'cascade'}),email:text('email').notNull(),
},t=>[primaryKey({columns:[t.profileId,t.email]}),index('idx_training_grants_email').on(t.email)]);
