CREATE TABLE `mission_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`mission_key` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `training_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_mission_instances_profile_key` ON `mission_instances` (`profile_id`,`mission_key`);--> statement-breakpoint
CREATE INDEX `idx_mission_instances_profile_status` ON `mission_instances` (`profile_id`,`status`);