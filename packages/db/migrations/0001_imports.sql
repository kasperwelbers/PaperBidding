CREATE TABLE `import_conflicts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conference_id` integer NOT NULL,
	`import_job_id` integer,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`existing_person_id` integer NOT NULL,
	`incoming_person_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`conference_id`) REFERENCES `conferences`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`import_job_id`) REFERENCES `import_jobs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`existing_person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`incoming_person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `import_conflicts_conference_idx` ON `import_conflicts` (`conference_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `import_conflicts_conference_id_kind_value_existing_person_id_incoming_person_id_unique` ON `import_conflicts` (`conference_id`,`kind`,`value`,`existing_person_id`,`incoming_person_id`);--> statement-breakpoint
CREATE TABLE `import_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` integer NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`filename` text NOT NULL,
	`file_key` text NOT NULL,
	`size` integer NOT NULL,
	`mapping` text,
	`total_chunks` integer,
	`done_chunks` integer DEFAULT 0 NOT NULL,
	`counts` text DEFAULT '{}' NOT NULL,
	`warnings` text DEFAULT '[]' NOT NULL,
	`error` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `import_jobs_edition_idx` ON `import_jobs` (`edition_id`);