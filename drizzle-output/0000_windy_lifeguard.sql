CREATE TABLE IF NOT EXISTS "author" (
	"submissionId" integer NOT NULL,
	"email" varchar(256) NOT NULL,
	CONSTRAINT author_submissionId_email PRIMARY KEY("submissionId","email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL,
	"token" varchar(32) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "submission" (
	"id" varchar(256) PRIMARY KEY NOT NULL,
	"projectId" integer,
	"title" text NOT NULL,
	"abstract" text NOT NULL,
	"features" jsonb NOT NULL,
	"isReference" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "volunteer" (
	"projectId" integer NOT NULL,
	"email" varchar(256) NOT NULL,
	"token" varchar(32) NOT NULL,
	CONSTRAINT volunteer_projectId_email PRIMARY KEY("projectId","email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "submission" ADD CONSTRAINT "submission_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
