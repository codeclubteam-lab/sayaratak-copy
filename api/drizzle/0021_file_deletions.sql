CREATE TABLE "file_deletions" (
	"id" text PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"mime" text NOT NULL,
	"delivery" "upload_delivery" NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "file_deletions_created_at_index" ON "file_deletions" USING btree ("created_at");