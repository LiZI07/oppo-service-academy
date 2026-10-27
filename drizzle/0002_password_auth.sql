CREATE TABLE `academy_auth_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `academy_auth_limit_expiry` ON `academy_auth_limits` (`expires`);--> statement-breakpoint
CREATE TABLE `academy_credentials` (
	`member_id` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `academy_reset_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`credential_version` integer NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `academy_reset_member` ON `academy_reset_tokens` (`member_id`);--> statement-breakpoint
CREATE TABLE `academy_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`credential_version` integer NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `academy_sessions_member` ON `academy_sessions` (`member_id`);--> statement-breakpoint
CREATE INDEX `academy_sessions_expiry` ON `academy_sessions` (`expires`);