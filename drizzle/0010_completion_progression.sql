CREATE TABLE `progression_rule_versions` (
	`version` text PRIMARY KEY NOT NULL,
	`config_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `progression_rule_versions` (`version`,`config_json`,`created_at`) VALUES ('tf-progression-v1','{"xpPerCompletedMinute":1,"intensityCoefficient":1,"completedActivityMultiplier":1,"skippedActivityMultiplier":0,"extraVolumeMultiplier":0,"firstEligibleReward":"FIRST_SAVE"}','2026-09-13T00:00:00.000Z');
--> statement-breakpoint
CREATE TABLE `mission_completion_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`mission_instance_id` text NOT NULL REFERENCES `mission_instances`(`id`) ON DELETE CASCADE,
	`profile_id` text NOT NULL REFERENCES `training_profiles`(`id`) ON DELETE CASCADE,
	`rule_version` text NOT NULL REFERENCES `progression_rule_versions`(`version`),
	`content_version` text NOT NULL,
	`completed_prescribed_minutes` integer NOT NULL,
	`skipped_prescribed_minutes` integer NOT NULL,
	`total_prescribed_minutes` integer NOT NULL,
	`completion_multiplier_milli` integer NOT NULL,
	`xp` integer NOT NULL,
	`xp_units` integer NOT NULL,
	`journey_before_json` text NOT NULL,
	`journey_after_json` text NOT NULL,
	`source_operation_key` text NOT NULL,
	`completed_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_mission_completion_instance` ON `mission_completion_ledger` (`mission_instance_id`);
--> statement-breakpoint
CREATE INDEX `idx_mission_completion_profile_time` ON `mission_completion_ledger` (`profile_id`,`completed_at`);
--> statement-breakpoint
CREATE TABLE `xp_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL REFERENCES `training_profiles`(`id`) ON DELETE CASCADE,
	`completion_id` text NOT NULL REFERENCES `mission_completion_ledger`(`id`) ON DELETE CASCADE,
	`logical_source` text NOT NULL,
	`amount` integer NOT NULL,
	`amount_units` integer NOT NULL,
	`rule_version` text NOT NULL REFERENCES `progression_rule_versions`(`version`),
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_xp_ledger_logical_source` ON `xp_ledger` (`logical_source`);
--> statement-breakpoint
CREATE INDEX `idx_xp_ledger_profile_time` ON `xp_ledger` (`profile_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `attribute_progress_ledger` (
	`completion_id` text NOT NULL REFERENCES `mission_completion_ledger`(`id`) ON DELETE CASCADE,
	`profile_id` text NOT NULL REFERENCES `training_profiles`(`id`) ON DELETE CASCADE,
	`attribute_id` text NOT NULL,
	`amount_units` integer NOT NULL,
	`rule_version` text NOT NULL REFERENCES `progression_rule_versions`(`version`),
	`created_at` text NOT NULL,
	PRIMARY KEY (`completion_id`,`attribute_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_attribute_progress_profile` ON `attribute_progress_ledger` (`profile_id`,`attribute_id`);
--> statement-breakpoint
CREATE TABLE `reward_entitlements` (
	`profile_id` text NOT NULL REFERENCES `training_profiles`(`id`) ON DELETE CASCADE,
	`reward_id` text NOT NULL,
	`source_completion_id` text NOT NULL REFERENCES `mission_completion_ledger`(`id`) ON DELETE CASCADE,
	`rule_version` text NOT NULL REFERENCES `progression_rule_versions`(`version`),
	`awarded_at` text NOT NULL,
	PRIMARY KEY (`profile_id`,`reward_id`)
);
