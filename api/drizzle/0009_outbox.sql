CREATE TYPE "public"."outbox_channel" AS ENUM('email', 'push');--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" "outbox_channel" NOT NULL,
	"to" text NOT NULL,
	"template" text NOT NULL,
	"locale" text NOT NULL,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"send_after" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "outbox_send_after_index" ON "outbox" USING btree ("send_after") WHERE "outbox"."sent_at" is null;