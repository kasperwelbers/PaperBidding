CREATE TABLE IF NOT EXISTS "authors" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"submission_id" varchar(256) NOT NULL,
	"email" varchar(256) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL,
	"read_token" varchar(32) NOT NULL,
	"edit_token" varchar(32) NOT NULL,
	CONSTRAINT "projects_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"submission_id" varchar(256) NOT NULL,
	"title" text NOT NULL,
	"abstract" text NOT NULL,
	"features" jsonb NOT NULL,
	"is_reference" boolean DEFAULT false NOT NULL,
	CONSTRAINT "submissions_project_id_submission_id_unique" UNIQUE("project_id","submission_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "volunteers" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"email" varchar(256) NOT NULL,
	"token" varchar(32) NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authors" ADD CONSTRAINT "authors_project_id_submission_id_submissions_project_id_submission_id_fk" FOREIGN KEY ("project_id","submission_id") REFERENCES "submissions"("project_id","submission_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "submissions" ADD CONSTRAINT "submissions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
