CREATE TABLE `training_measurements` (
 `id` text PRIMARY KEY NOT NULL,
 `profile_id` text NOT NULL REFERENCES `training_profiles`(`id`) ON DELETE CASCADE,
 `protocol_id` text NOT NULL,
 `attribute_id` text NOT NULL,
 `metric` text NOT NULL,
 `kind` text NOT NULL,
 `value` integer NOT NULL,
 `valid` integer NOT NULL,
 `recorded_at` text NOT NULL,
 `source_operation_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_training_measurements_operation` ON `training_measurements` (`profile_id`,`source_operation_key`);
--> statement-breakpoint
CREATE INDEX `idx_training_measurements_profile_protocol` ON `training_measurements` (`profile_id`,`protocol_id`,`recorded_at`);
