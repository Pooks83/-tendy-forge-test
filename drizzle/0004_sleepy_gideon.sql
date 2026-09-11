CREATE TABLE `product_events` (
	`id` text PRIMARY KEY NOT NULL,
	`logical_key` text NOT NULL,
	`event_name` text NOT NULL,
	`account_context_id` text,
	`profile_context_id` text,
	`app_version` text NOT NULL,
	`build_version` text NOT NULL,
	`config_version` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_context_id`) REFERENCES `training_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_product_events_logical_key` ON `product_events` (`logical_key`);--> statement-breakpoint
CREATE INDEX `idx_product_events_name_created` ON `product_events` (`event_name`,`created_at`);