CREATE TABLE `division_reviewer_exclusions` (
	`reviewer_id` integer NOT NULL,
	`division_id` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`reviewer_id`, `division_id`),
	FOREIGN KEY (`reviewer_id`) REFERENCES `reviewers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `import_jobs` ADD `division_id` integer REFERENCES divisions(id) ON DELETE set null;