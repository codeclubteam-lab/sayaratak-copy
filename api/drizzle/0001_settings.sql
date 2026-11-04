CREATE TYPE "public"."backup_schedule" AS ENUM('daily', 'weekly', 'off');--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"auto_approve_verified_dealers" boolean NOT NULL,
	"listing_expiry_days" integer NOT NULL,
	"individual_subscriptions_enabled" boolean NOT NULL,
	"free_listing_limit" integer NOT NULL,
	"bankak_name" text NOT NULL,
	"bankak_number" text NOT NULL,
	"contact" jsonb NOT NULL,
	"locales" text[] NOT NULL,
	"backup_schedule" "backup_schedule" NOT NULL,
	"last_auto_backup_at" timestamp with time zone,
	CONSTRAINT "settings_single_row" CHECK ("settings"."id" = 1),
	CONSTRAINT "settings_locales_known" CHECK ("settings"."locales" <@ array['ar', 'en']),
	CONSTRAINT "settings_expiry_positive" CHECK ("settings"."listing_expiry_days" > 0),
	CONSTRAINT "settings_free_limit_not_negative" CHECK ("settings"."free_listing_limit" >= 0)
);
