CREATE TYPE "public"."device_platform" AS ENUM('ios', 'android');--> statement-breakpoint
CREATE TABLE "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" "device_platform" NOT NULL,
	"fcm_token" text NOT NULL,
	"app_version" text NOT NULL,
	"locale" text NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "devices_fcmToken_unique" UNIQUE("fcm_token"),
	CONSTRAINT "devices_locale" CHECK ("devices"."locale" in ('ar', 'en'))
);
--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "devices_user_id_index" ON "devices" USING btree ("user_id");