CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`owner` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`subject` text NOT NULL,
	`action` text NOT NULL,
	`data` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_id` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`store` text DEFAULT '' NOT NULL,
	`trainer` text,
	`hire` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_auth_id_unique` ON `members` (`auth_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_email_unique` ON `members` (`email`);