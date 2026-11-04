-- pg_trgm backs the GIN index on listings.search_text (q search). Added by hand: drizzle-kit does not write extensions.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."condition" AS ENUM('new', 'used');--> statement-breakpoint
CREATE TYPE "public"."fuel" AS ENUM('petrol', 'diesel', 'hybrid', 'electric', 'lpg');--> statement-breakpoint
CREATE TYPE "public"."intent" AS ENUM('sale', 'rent');--> statement-breakpoint
CREATE TYPE "public"."listing_kind" AS ENUM('vehicle', 'part');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('available', 'reserved', 'sold', 'rented');--> statement-breakpoint
CREATE TYPE "public"."moderation" AS ENUM('draft', 'pending', 'approved', 'rejected', 'removed');--> statement-breakpoint
CREATE TYPE "public"."owner_type" AS ENUM('user', 'dealership');--> statement-breakpoint
CREATE TYPE "public"."rent_period" AS ENUM('day', 'week', 'month');--> statement-breakpoint
CREATE TYPE "public"."transmission" AS ENUM('automatic', 'manual');--> statement-breakpoint
CREATE TABLE "drafts" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "drafts_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "listing_media" (
	"listing_id" text NOT NULL,
	"position" integer NOT NULL,
	"upload_id" text NOT NULL,
	CONSTRAINT "listing_media_listing_id_position_pk" PRIMARY KEY("listing_id","position"),
	CONSTRAINT "listing_media_uploadId_unique" UNIQUE("upload_id")
);
--> statement-breakpoint
CREATE TABLE "listing_stats" (
	"listing_id" text PRIMARY KEY NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"favorites" integer DEFAULT 0 NOT NULL,
	"phone_clicks" integer DEFAULT 0 NOT NULL,
	"whatsapp_clicks" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"owner_user_id" text,
	"owner_type" "owner_type" NOT NULL,
	"owner_name" jsonb NOT NULL,
	"kind" "listing_kind" NOT NULL,
	"intent" "intent" NOT NULL,
	"vehicle_type" "vehicle_type",
	"title" text NOT NULL,
	"description" jsonb NOT NULL,
	"price" bigint NOT NULL,
	"negotiable" boolean NOT NULL,
	"rent_period" "rent_period",
	"condition" "condition" NOT NULL,
	"make_id" text,
	"model_id" text,
	"make_other" text,
	"model_other" text,
	"year" integer,
	"mileage_km" integer,
	"fuel" "fuel",
	"transmission" "transmission",
	"color" text,
	"engine_cc" integer,
	"payload_tons" double precision,
	"part_number" text,
	"part_category_id" text,
	"compatible_types" "vehicle_type"[] DEFAULT '{}' NOT NULL,
	"details" jsonb NOT NULL,
	"city_id" text NOT NULL,
	"district_id" text,
	"lat" double precision,
	"lng" double precision,
	"contact" jsonb NOT NULL,
	"status" "listing_status" NOT NULL,
	"moderation" "moderation" NOT NULL,
	"rejection_reason" text,
	"search_text" text NOT NULL,
	"bumped_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"expired_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "listings_slug_unique" UNIQUE("slug"),
	CONSTRAINT "listings_id" CHECK ("listings"."id" ~ '^l[0-9a-z]{5}$'),
	CONSTRAINT "listings_owner_name" CHECK ((jsonb_typeof("listings"."owner_name" -> 'ar') = 'string' and jsonb_typeof("listings"."owner_name" -> 'en') = 'string') is true),
	CONSTRAINT "listings_description" CHECK ((jsonb_typeof("listings"."description" -> 'ar') = 'string' and jsonb_typeof("listings"."description" -> 'en') = 'string') is true),
	CONSTRAINT "listings_price" CHECK ("listings"."price" >= 0),
	CONSTRAINT "listings_mileage" CHECK ("listings"."mileage_km" >= 0),
	CONSTRAINT "listings_geo" CHECK ((("listings"."lat" is null) = ("listings"."lng" is null)) and coalesce("listings"."lat" between -90 and 90 and "listings"."lng" between -180 and 180, true))
);
--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_stats" ADD CONSTRAINT "listing_stats_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_make_id_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."makes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_part_category_id_part_categories_id_fk" FOREIGN KEY ("part_category_id") REFERENCES "public"."part_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listings_owner_user_id_index" ON "listings" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "listings_city_id_index" ON "listings" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "listings_district_id_index" ON "listings" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "listings_make_id_index" ON "listings" USING btree ("make_id");--> statement-breakpoint
CREATE INDEX "listings_model_id_index" ON "listings" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "listings_part_category_id_index" ON "listings" USING btree ("part_category_id");--> statement-breakpoint
CREATE INDEX "listings_public" ON "listings" USING btree ("kind","intent","vehicle_type") WHERE "listings"."moderation" = 'approved';--> statement-breakpoint
CREATE INDEX "listings_price_index" ON "listings" USING btree ("price");--> statement-breakpoint
CREATE INDEX "listings_year_index" ON "listings" USING btree ("year");--> statement-breakpoint
CREATE INDEX "listings_mileage_km_index" ON "listings" USING btree ("mileage_km");--> statement-breakpoint
CREATE INDEX "listings_posted" ON "listings" USING btree (coalesce("bumped_at", "created_at") desc);--> statement-breakpoint
CREATE INDEX "listings_expires_at_index" ON "listings" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "listings_compatible_types_index" ON "listings" USING gin ("compatible_types");--> statement-breakpoint
CREATE INDEX "listings_details" ON "listings" USING gin ("details" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "listings_search_text_index" ON "listings" USING gin ("search_text" gin_trgm_ops);