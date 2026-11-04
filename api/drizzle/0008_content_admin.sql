CREATE TYPE "public"."backup_status" AS ENUM('running', 'ready', 'restoring', 'failed');--> statement-breakpoint
CREATE TYPE "public"."backup_type" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('view', 'phone_click', 'whatsapp_click', 'share', 'banner_click', 'banner_view');--> statement-breakpoint
CREATE TYPE "public"."contact_subject" AS ENUM('general', 'listing_help', 'business', 'report_problem');--> statement-breakpoint
CREATE TYPE "public"."site_page_slug" AS ENUM('about', 'contact', 'privacy', 'terms');--> statement-breakpoint
CREATE TABLE "backups" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "backup_type" NOT NULL,
	"status" "backup_status" NOT NULL,
	"object_key" text,
	"bytes" bigint,
	"created_by" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "backups_ready_has_file" CHECK ("backups"."status" <> 'ready' or ("backups"."object_key" is not null and "backups"."bytes" is not null)),
	CONSTRAINT "backups_bytes" CHECK ("backups"."bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"day" date NOT NULL,
	"target_id" text NOT NULL,
	"type" "event_type" NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "events_target_id_day_type_pk" PRIMARY KEY("target_id","day","type"),
	CONSTRAINT "events_count_positive" CHECK ("events"."count" > 0)
);
--> statement-breakpoint
CREATE TABLE "login_failures" (
	"email" text NOT NULL,
	"failed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact" text NOT NULL,
	"subject" "contact_subject" NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_pages" (
	"slug" "site_page_slug" PRIMARY KEY NOT NULL,
	"title" jsonb NOT NULL,
	"body" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "site_pages_title_bilingual" CHECK ((jsonb_typeof("site_pages"."title" -> 'ar') = 'string' and jsonb_typeof("site_pages"."title" -> 'en') = 'string') is true),
	CONSTRAINT "site_pages_body_bilingual" CHECK ((jsonb_typeof("site_pages"."body" -> 'ar') = 'string' and jsonb_typeof("site_pages"."body" -> 'en') = 'string') is true)
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" text PRIMARY KEY NOT NULL,
	"title" jsonb NOT NULL,
	"body" jsonb NOT NULL,
	"href" text,
	"roles" "role"[] NOT NULL,
	"city_id" text,
	"verified_only" boolean NOT NULL,
	"recipients" integer NOT NULL,
	"sent_by" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "broadcasts_title" CHECK ((jsonb_typeof("broadcasts"."title" -> 'ar') = 'string' and jsonb_typeof("broadcasts"."title" -> 'en') = 'string') is true),
	CONSTRAINT "broadcasts_body" CHECK ((jsonb_typeof("broadcasts"."body" -> 'ar') = 'string' and jsonb_typeof("broadcasts"."body" -> 'en') = 'string') is true),
	CONSTRAINT "broadcasts_roles" CHECK (cardinality("broadcasts"."roles") > 0),
	CONSTRAINT "broadcasts_recipients" CHECK ("broadcasts"."recipients" >= 0)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"ip" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "backups" ADD CONSTRAINT "backups_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_sent_by_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "backups_created_at_index" ON "backups" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "login_failures_email_failed_at_index" ON "login_failures" USING btree ("email","failed_at");--> statement-breakpoint
CREATE INDEX "contacts_created_at_index" ON "contacts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "broadcasts_created_at_index" ON "broadcasts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_index" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_target_type_target_id_index" ON "audit_log" USING btree ("target_type","target_id");