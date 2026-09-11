CREATE TABLE `onboarding_drafts` (
	`account_id` text PRIMARY KEY NOT NULL,
	`step` text NOT NULL,
	`draft_json` text NOT NULL,
	`operation_key` text NOT NULL,
	`consent_version` text NOT NULL,
	`policy_version` text NOT NULL,
	`permission_accepted_at` text NOT NULL,
	`updated_at` text NOT NULL
);
