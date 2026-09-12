CREATE TABLE `activity_families` (
	`family_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);--> statement-breakpoint
CREATE TABLE `activity_versions` (
	`activity_id` text NOT NULL,
	`version` integer NOT NULL,
	`family_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`content_status` text NOT NULL,
	`development_reviewer_id` text,
	`development_reviewed_at` text,
	`safety_reviewer_id` text,
	`safety_reviewed_at` text,
	`published_at` text,
	`retired_at` text,
	`retirement_reason` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`activity_id`,`version`),
	FOREIGN KEY (`family_id`) REFERENCES `activity_families`(`family_id`) ON UPDATE no action ON DELETE restrict
);--> statement-breakpoint
CREATE INDEX `idx_activity_versions_published_family` ON `activity_versions` (`family_id`,`version`) WHERE `content_status`='PUBLISHED' AND `retired_at` IS NULL;
