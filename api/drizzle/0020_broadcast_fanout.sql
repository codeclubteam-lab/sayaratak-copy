CREATE TYPE "public"."broadcast_status" AS ENUM('queued', 'sending', 'sent');--> statement-breakpoint
ALTER TABLE "broadcasts" ADD COLUMN "status" "broadcast_status" DEFAULT 'sent' NOT NULL;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD COLUMN "cursor" text;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "broadcasts_unfinished" ON "broadcasts" USING btree ("created_at") WHERE "broadcasts"."status" <> 'sent';--> statement-breakpoint
-- Every broadcast sent before the job existed is finished, at the moment it was sent.
UPDATE "broadcasts" SET "finished_at" = "created_at";--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_finished" CHECK ("broadcasts"."status" <> 'sent' or "broadcasts"."finished_at" is not null);