ALTER TABLE "authors" DROP CONSTRAINT "authors_project_id_submission_id_submissions_project_id_submission_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authors" ADD CONSTRAINT "authors_project_id_submission_id_submissions_project_id_submission_id_fk" FOREIGN KEY ("project_id","submission_id") REFERENCES "submissions"("project_id","submission_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
