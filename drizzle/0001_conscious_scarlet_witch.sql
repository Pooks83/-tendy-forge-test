CREATE TABLE `active_player_context` (
	`account_id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `training_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_account_id` text NOT NULL,
	`profile_id` text,
	`event_type` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_profile_created` ON `audit_events` (`profile_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `consent_records` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`consent_version` text NOT NULL,
	`purposes_json` text NOT NULL,
	`policy_version` text NOT NULL,
	`accepted_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`profile_id`) REFERENCES `training_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_consent_records_profile` ON `consent_records` (`profile_id`,`accepted_at`);--> statement-breakpoint
CREATE TABLE `deletion_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`status` text NOT NULL,
	`requested_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_deletion_requests_account` ON `deletion_requests` (`account_id`,`requested_at`);--> statement-breakpoint
CREATE TABLE `guardian_player` (
	`account_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`relationship` text DEFAULT 'guardian' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text,
	PRIMARY KEY(`account_id`, `profile_id`),
	FOREIGN KEY (`profile_id`) REFERENCES `training_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_guardian_player_account` ON `guardian_player` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_guardian_player_profile` ON `guardian_player` (`profile_id`,`status`);--> statement-breakpoint
CREATE TABLE `idempotency_records` (
	`account_id` text NOT NULL,
	`operation_key` text NOT NULL,
	`operation` text NOT NULL,
	`response_json` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`account_id`, `operation_key`)
);
--> statement-breakpoint
CREATE TABLE `privacy_preferences` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`analytics_allowed` integer DEFAULT false NOT NULL,
	`notifications_allowed` integer DEFAULT false NOT NULL,
	`clips_allowed` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `training_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `training_profiles` ADD `catches` text;--> statement-breakpoint
ALTER TABLE `training_profiles` ADD `experience` text;--> statement-breakpoint
ALTER TABLE `training_profiles` ADD `equipment_json` text;--> statement-breakpoint
ALTER TABLE `training_profiles` ADD `planned_days_json` text;--> statement-breakpoint
ALTER TABLE `training_profiles` ADD `mission_minutes` integer;--> statement-breakpoint
ALTER TABLE `training_profiles` ADD `setup_status` text DEFAULT 'legacy-review-required' NOT NULL;--> statement-breakpoint
ALTER TABLE `training_profiles` ADD `updated_at` text;