CREATE TABLE `first_challenge_results` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`protocol_version` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`result_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `training_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT OR IGNORE INTO `guardian_player` (`account_id`,`profile_id`,`relationship`,`status`,`created_at`)
SELECT `owner_id`,`id`,'guardian','active',`created_at` FROM `training_profiles`;
--> statement-breakpoint
INSERT OR IGNORE INTO `active_player_context` (`account_id`,`profile_id`,`updated_at`)
SELECT p.`owner_id`,p.`id`,COALESCE(p.`updated_at`,p.`created_at`)
FROM `training_profiles` p
WHERE p.`id`=(SELECT p2.`id` FROM `training_profiles` p2 WHERE p2.`owner_id`=p.`owner_id` ORDER BY p2.`created_at`,p2.`id` LIMIT 1);
