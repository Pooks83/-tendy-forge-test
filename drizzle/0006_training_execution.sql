ALTER TABLE `mission_instances` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `mission_instances` ADD `current_activity_index` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `mission_instances` ADD `content_version` text DEFAULT 'tf-curriculum-legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `mission_instances` ADD `execution_snapshot_json` text DEFAULT '{"blocks":[]}' NOT NULL;--> statement-breakpoint
ALTER TABLE `mission_instances` ADD `paused_at` text;--> statement-breakpoint
ALTER TABLE `mission_instances` ADD `interrupted_at` text;--> statement-breakpoint
ALTER TABLE `mission_instances` ADD `abandoned_at` text;--> statement-breakpoint
UPDATE `mission_instances` SET `status`=UPPER(REPLACE(`status`,'-','_'));--> statement-breakpoint
CREATE UNIQUE INDEX `idx_mission_instances_one_active` ON `mission_instances` (`profile_id`) WHERE `status` IN ('IN_PROGRESS','PAUSED','INTERRUPTED');--> statement-breakpoint
CREATE TABLE `activity_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`mission_instance_id` text NOT NULL,
	`activity_key` text NOT NULL,
	`ordinal` integer NOT NULL,
	`status` text NOT NULL,
	`result_json` text,
	`rest_remaining_seconds` integer DEFAULT 0 NOT NULL,
	`started_at` text,
	`completed_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`mission_instance_id`) REFERENCES `mission_instances`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_activity_instances_mission_ordinal` ON `activity_instances` (`mission_instance_id`,`ordinal`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_activity_instances_mission_key` ON `activity_instances` (`mission_instance_id`,`activity_key`);
