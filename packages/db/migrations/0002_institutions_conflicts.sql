CREATE TABLE `institution_aliases` (
	`conference_id` integer NOT NULL,
	`raw` text NOT NULL,
	`institution` text NOT NULL,
	PRIMARY KEY(`conference_id`, `raw`),
	FOREIGN KEY (`conference_id`) REFERENCES `conferences`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `conferences` ADD `conflict_rules` text DEFAULT '{"coAuthorsCurrentEdition":true,"coAuthorsPreviousEditions":true,"sameInstitution":true}' NOT NULL;--> statement-breakpoint
ALTER TABLE `persons` ADD `institution_raw` text;--> statement-breakpoint
ALTER TABLE `submission_authors` ADD `institution_raw` text;--> statement-breakpoint
ALTER TABLE `edition_persons` DROP COLUMN `name`;--> statement-breakpoint
ALTER TABLE `edition_persons` DROP COLUMN `institution`;