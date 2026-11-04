CREATE TYPE "public"."role" AS ENUM('user', 'dealership', 'workshop', 'mechanic', 'admin');--> statement-breakpoint
CREATE TYPE "public"."profile_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."upload_delivery" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."upload_kind" AS ENUM('image', 'video', 'receipt', 'document');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"two_factor_enabled" boolean DEFAULT false,
	"role" "role" DEFAULT 'user' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"phone" text,
	"verified_phone" boolean DEFAULT false NOT NULL,
	"avatar_upload_id" text,
	"city_id" text,
	"locale" text DEFAULT 'ar' NOT NULL,
	"onboarding_done" boolean DEFAULT false NOT NULL,
	"interests" text[] DEFAULT '{}' NOT NULL,
	"prefs" jsonb NOT NULL,
	"chosen_plan_id" text,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_email_lower" CHECK ("user"."email" = lower("user"."email")),
	CONSTRAINT "user_locale" CHECK ("user"."locale" in ('ar', 'en'))
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dealerships" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" jsonb NOT NULL,
	"city_id" text NOT NULL,
	"whatsapp" text,
	"verified" boolean DEFAULT false NOT NULL,
	"status" "profile_status" DEFAULT 'active' NOT NULL,
	"suspended_reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"district_id" text,
	"address" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"hours" jsonb NOT NULL,
	"logo_upload_id" text,
	"cover_upload_id" text,
	"description" jsonb NOT NULL,
	"phones" text[] NOT NULL,
	CONSTRAINT "dealerships_ownerUserId_unique" UNIQUE("owner_user_id"),
	CONSTRAINT "dealerships_slug_unique" UNIQUE("slug"),
	CONSTRAINT "dealerships_name" CHECK ((jsonb_typeof("dealerships"."name" -> 'ar') = 'string' and jsonb_typeof("dealerships"."name" -> 'en') = 'string') is true),
	CONSTRAINT "dealerships_description" CHECK ((jsonb_typeof("dealerships"."description" -> 'ar') = 'string' and jsonb_typeof("dealerships"."description" -> 'en') = 'string') is true),
	CONSTRAINT "dealerships_geo" CHECK ((("dealerships"."lat" is null) = ("dealerships"."lng" is null)) and coalesce("dealerships"."lat" between -90 and 90 and "dealerships"."lng" between -180 and 180, true)),
	CONSTRAINT "dealerships_phones" CHECK (cardinality("dealerships"."phones") > 0)
);
--> statement-breakpoint
CREATE TABLE "mechanic_cities" (
	"mechanic_id" text NOT NULL,
	"city_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "mechanic_cities_mechanic_id_city_id_pk" PRIMARY KEY("mechanic_id","city_id")
);
--> statement-breakpoint
CREATE TABLE "mechanic_specializations" (
	"mechanic_id" text NOT NULL,
	"specialization_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "mechanic_specializations_mechanic_id_specialization_id_pk" PRIMARY KEY("mechanic_id","specialization_id")
);
--> statement-breakpoint
CREATE TABLE "mechanics" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" jsonb NOT NULL,
	"city_id" text NOT NULL,
	"whatsapp" text,
	"verified" boolean DEFAULT false NOT NULL,
	"status" "profile_status" DEFAULT 'active' NOT NULL,
	"suspended_reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"photo_upload_id" text,
	"bio" jsonb NOT NULL,
	"years_of_experience" integer NOT NULL,
	"phone" text NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	CONSTRAINT "mechanics_ownerUserId_unique" UNIQUE("owner_user_id"),
	CONSTRAINT "mechanics_slug_unique" UNIQUE("slug"),
	CONSTRAINT "mechanics_name" CHECK ((jsonb_typeof("mechanics"."name" -> 'ar') = 'string' and jsonb_typeof("mechanics"."name" -> 'en') = 'string') is true),
	CONSTRAINT "mechanics_bio" CHECK ((jsonb_typeof("mechanics"."bio" -> 'ar') = 'string' and jsonb_typeof("mechanics"."bio" -> 'en') = 'string') is true),
	CONSTRAINT "mechanics_years" CHECK ("mechanics"."years_of_experience" >= 0)
);
--> statement-breakpoint
CREATE TABLE "portfolio_items" (
	"id" text PRIMARY KEY NOT NULL,
	"mechanic_id" text NOT NULL,
	"upload_id" text NOT NULL,
	"caption" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "portfolio_items_uploadId_unique" UNIQUE("upload_id"),
	CONSTRAINT "portfolio_items_mechanicId_position_unique" UNIQUE("mechanic_id","position")
);
--> statement-breakpoint
CREATE TABLE "workshop_images" (
	"workshop_id" text NOT NULL,
	"position" integer NOT NULL,
	"upload_id" text NOT NULL,
	CONSTRAINT "workshop_images_workshop_id_position_pk" PRIMARY KEY("workshop_id","position"),
	CONSTRAINT "workshop_images_uploadId_unique" UNIQUE("upload_id")
);
--> statement-breakpoint
CREATE TABLE "workshop_services" (
	"id" text PRIMARY KEY NOT NULL,
	"workshop_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price_from" integer,
	"template_id" text,
	"position" integer NOT NULL,
	CONSTRAINT "workshop_services_workshopId_position_unique" UNIQUE("workshop_id","position"),
	CONSTRAINT "workshop_services_price" CHECK ("workshop_services"."price_from" >= 0)
);
--> statement-breakpoint
CREATE TABLE "workshops" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" jsonb NOT NULL,
	"city_id" text NOT NULL,
	"whatsapp" text,
	"verified" boolean DEFAULT false NOT NULL,
	"status" "profile_status" DEFAULT 'active' NOT NULL,
	"suspended_reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"district_id" text,
	"address" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"hours" jsonb NOT NULL,
	"logo_upload_id" text,
	"cover_upload_id" text,
	"description" jsonb NOT NULL,
	"phone" text NOT NULL,
	CONSTRAINT "workshops_ownerUserId_unique" UNIQUE("owner_user_id"),
	CONSTRAINT "workshops_slug_unique" UNIQUE("slug"),
	CONSTRAINT "workshops_name" CHECK ((jsonb_typeof("workshops"."name" -> 'ar') = 'string' and jsonb_typeof("workshops"."name" -> 'en') = 'string') is true),
	CONSTRAINT "workshops_description" CHECK ((jsonb_typeof("workshops"."description" -> 'ar') = 'string' and jsonb_typeof("workshops"."description" -> 'en') = 'string') is true),
	CONSTRAINT "workshops_geo" CHECK ((("workshops"."lat" is null) = ("workshops"."lng" is null)) and coalesce("workshops"."lat" between -90 and 90 and "workshops"."lng" between -180 and 180, true))
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text,
	"kind" "upload_kind" NOT NULL,
	"cloudinary_id" text,
	"url" text,
	"delivery" "upload_delivery" NOT NULL,
	"width" integer,
	"height" integer,
	"placeholder_color" text,
	"bytes" integer,
	"mime" text,
	"poster_id" text,
	"attached_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uploads_one_source" CHECK (("uploads"."cloudinary_id" is null) <> ("uploads"."url" is null)),
	CONSTRAINT "uploads_private_kinds" CHECK (("uploads"."delivery" = 'private') = ("uploads"."kind" in ('receipt', 'document')))
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_avatar_upload_id_uploads_id_fk" FOREIGN KEY ("avatar_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealerships" ADD CONSTRAINT "dealerships_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealerships" ADD CONSTRAINT "dealerships_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealerships" ADD CONSTRAINT "dealerships_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealerships" ADD CONSTRAINT "dealerships_logo_upload_id_uploads_id_fk" FOREIGN KEY ("logo_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealerships" ADD CONSTRAINT "dealerships_cover_upload_id_uploads_id_fk" FOREIGN KEY ("cover_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mechanic_cities" ADD CONSTRAINT "mechanic_cities_mechanic_id_mechanics_id_fk" FOREIGN KEY ("mechanic_id") REFERENCES "public"."mechanics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mechanic_cities" ADD CONSTRAINT "mechanic_cities_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mechanic_specializations" ADD CONSTRAINT "mechanic_specializations_mechanic_id_mechanics_id_fk" FOREIGN KEY ("mechanic_id") REFERENCES "public"."mechanics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mechanic_specializations" ADD CONSTRAINT "mechanic_specializations_specialization_id_specializations_id_fk" FOREIGN KEY ("specialization_id") REFERENCES "public"."specializations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mechanics" ADD CONSTRAINT "mechanics_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mechanics" ADD CONSTRAINT "mechanics_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mechanics" ADD CONSTRAINT "mechanics_photo_upload_id_uploads_id_fk" FOREIGN KEY ("photo_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_mechanic_id_mechanics_id_fk" FOREIGN KEY ("mechanic_id") REFERENCES "public"."mechanics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_images" ADD CONSTRAINT "workshop_images_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_images" ADD CONSTRAINT "workshop_images_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_services" ADD CONSTRAINT "workshop_services_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_services" ADD CONSTRAINT "workshop_services_template_id_service_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."service_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_logo_upload_id_uploads_id_fk" FOREIGN KEY ("logo_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_cover_upload_id_uploads_id_fk" FOREIGN KEY ("cover_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_poster_id_uploads_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_index" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_index" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_secret_index" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "two_factor_user_id_index" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_phone_index" ON "user" USING btree ("phone") WHERE "user"."phone" is not null;--> statement-breakpoint
CREATE INDEX "verification_identifier_index" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "dealerships_city_id_index" ON "dealerships" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "mechanic_cities_city_id_index" ON "mechanic_cities" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "mechanic_specializations_specialization_id_index" ON "mechanic_specializations" USING btree ("specialization_id");--> statement-breakpoint
CREATE INDEX "mechanics_city_id_index" ON "mechanics" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "workshop_services_template_id_index" ON "workshop_services" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "workshops_city_id_index" ON "workshops" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "uploads_owner_user_id_index" ON "uploads" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "uploads_created_at_index" ON "uploads" USING btree ("created_at") WHERE "uploads"."attached_at" is null;