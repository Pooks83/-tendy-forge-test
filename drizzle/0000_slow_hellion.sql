CREATE TABLE `training_coach_grants` (
	`profile_id` text NOT NULL,
	`email` text NOT NULL,
	PRIMARY KEY(`profile_id`, `email`),
	FOREIGN KEY (`profile_id`) REFERENCES `training_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_training_grants_email` ON `training_coach_grants` (`email`);--> statement-breakpoint
CREATE TABLE `training_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`nickname` text NOT NULL,
	`team` text NOT NULL,
	`age_band` text NOT NULL,
	`state` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_training_profiles_owner` ON `training_profiles` (`owner_id`);