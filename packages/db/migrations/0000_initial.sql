CREATE TABLE `admins` (
	`email` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assignments` (
	`division_edition_id` integer PRIMARY KEY NOT NULL,
	`settings` text NOT NULL,
	`result` text NOT NULL,
	`backups` text NOT NULL,
	`computed_at` integer NOT NULL,
	`exported_at` integer,
	FOREIGN KEY (`division_edition_id`) REFERENCES `division_editions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `auth_account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_account_user_idx` ON `auth_account` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_session_token_unique` ON `auth_session` (`token`);--> statement-breakpoint
CREATE INDEX `auth_session_user_idx` ON `auth_session` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_user_email_unique` ON `auth_user` (`email`);--> statement-breakpoint
CREATE TABLE `auth_verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_verification_identifier_idx` ON `auth_verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `bids` (
	`division_edition_id` integer NOT NULL,
	`reviewer_id` integer NOT NULL,
	`submission_ids` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`division_edition_id`, `reviewer_id`),
	FOREIGN KEY (`division_edition_id`) REFERENCES `division_editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_id`) REFERENCES `reviewers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `conference_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conference_id` integer NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`conference_id`) REFERENCES `conferences`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conference_users_email_idx` ON `conference_users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `conference_users_conference_id_email_unique` ON `conference_users` (`conference_id`,`email`);--> statement-breakpoint
CREATE TABLE `conferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`platform` text NOT NULL,
	`preset` text,
	`settings` text DEFAULT '{}' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `division_editions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`division_id` integer NOT NULL,
	`edition_id` integer NOT NULL,
	`bidding_deadline` integer,
	`matching_settings` text,
	`reference_sources` text DEFAULT '{"divisionIds":[],"editionIds":[]}' NOT NULL,
	`join_token` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `division_editions_division_id_edition_id_unique` ON `division_editions` (`division_id`,`edition_id`);--> statement-breakpoint
CREATE TABLE `divisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conference_id` integer NOT NULL,
	`name` text NOT NULL,
	`platform_key` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`conference_id`) REFERENCES `conferences`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `divisions_conference_id_name_unique` ON `divisions` (`conference_id`,`name`);--> statement-breakpoint
CREATE TABLE `edition_persons` (
	`edition_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`name` text,
	`institution` text,
	`source` text NOT NULL,
	PRIMARY KEY(`edition_id`, `person_id`),
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `editions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conference_id` integer NOT NULL,
	`name` text NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`conference_id`) REFERENCES `conferences`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `editions_conference_id_name_unique` ON `editions` (`conference_id`,`name`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`division_edition_id` integer NOT NULL,
	`reviewer_id` integer NOT NULL,
	`sent_at` integer NOT NULL,
	PRIMARY KEY(`division_edition_id`, `reviewer_id`),
	FOREIGN KEY (`division_edition_id`) REFERENCES `division_editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_id`) REFERENCES `reviewers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `keywords` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conference_id` integer NOT NULL,
	`text` text NOT NULL,
	`division_id` integer,
	`assigned_by` text,
	FOREIGN KEY (`conference_id`) REFERENCES `conferences`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `keywords_conference_id_text_unique` ON `keywords` (`conference_id`,`text`);--> statement-breakpoint
CREATE TABLE `person_identifiers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conference_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`conference_id`) REFERENCES `conferences`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `person_identifiers_person_idx` ON `person_identifiers` (`person_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `person_identifiers_conference_id_kind_value_unique` ON `person_identifiers` (`conference_id`,`kind`,`value`);--> statement-breakpoint
CREATE TABLE `persons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conference_id` integer NOT NULL,
	`name` text,
	`institution` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`conference_id`) REFERENCES `conferences`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `persons_conference_idx` ON `persons` (`conference_id`);--> statement-breakpoint
CREATE TABLE `planner_divisions` (
	`conference_user_id` integer NOT NULL,
	`division_id` integer NOT NULL,
	PRIMARY KEY(`conference_user_id`, `division_id`),
	FOREIGN KEY (`conference_user_id`) REFERENCES `conference_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reviewer_divisions` (
	`reviewer_id` integer NOT NULL,
	`division_id` integer NOT NULL,
	`source` text NOT NULL,
	PRIMARY KEY(`reviewer_id`, `division_id`, `source`),
	FOREIGN KEY (`reviewer_id`) REFERENCES `reviewers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reviewer_divisions_division_idx` ON `reviewer_divisions` (`division_id`);--> statement-breakpoint
CREATE TABLE `reviewer_keywords` (
	`reviewer_id` integer NOT NULL,
	`keyword_id` integer NOT NULL,
	PRIMARY KEY(`reviewer_id`, `keyword_id`),
	FOREIGN KEY (`reviewer_id`) REFERENCES `reviewers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`keyword_id`) REFERENCES `keywords`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reviewers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`student` integer DEFAULT false NOT NULL,
	`can_review` integer DEFAULT true NOT NULL,
	`source` text NOT NULL,
	`secret` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviewers_edition_id_person_id_unique` ON `reviewers` (`edition_id`,`person_id`);--> statement-breakpoint
CREATE TABLE `submission_authors` (
	`submission_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`position` integer NOT NULL,
	`institution` text,
	PRIMARY KEY(`submission_id`, `position`),
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `submission_authors_person_idx` ON `submission_authors` (`person_id`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` integer NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`abstract` text NOT NULL,
	`division_id` integer,
	`status` text,
	`embedding` blob,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `submissions_division_idx` ON `submissions` (`edition_id`,`division_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_edition_id_external_id_unique` ON `submissions` (`edition_id`,`external_id`);