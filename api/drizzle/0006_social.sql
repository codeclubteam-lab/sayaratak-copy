CREATE TYPE "public"."thread_subject" AS ENUM('listing', 'dealership', 'workshop', 'mechanic');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('message', 'listing_approved', 'listing_rejected', 'saved_search_match', 'review_new', 'payment_approved', 'payment_rejected', 'subscription_expiring', 'verification_result', 'business_status', 'broadcast');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('scam', 'wrong_category', 'already_sold', 'duplicate', 'inappropriate', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('visible', 'hidden', 'flagged');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('dealership', 'workshop', 'mechanic');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "favorites_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "thread_participants" (
	"thread_id" text NOT NULL,
	"user_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "thread_participants_thread_id_user_id_pk" PRIMARY KEY("thread_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_type" "thread_subject" NOT NULL,
	"subject_id" text NOT NULL,
	"subject_title" jsonb NOT NULL,
	"subject_image" text,
	"pair_key" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "threads_subjectType_subjectId_pairKey_unique" UNIQUE("subject_type","subject_id","pair_key"),
	CONSTRAINT "threads_subject_title" CHECK ((jsonb_typeof("threads"."subject_title" -> 'ar') = 'string' and jsonb_typeof("threads"."subject_title" -> 'en') = 'string') is true)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" jsonb NOT NULL,
	"body" jsonb NOT NULL,
	"href" text,
	"created_at" timestamp with time zone NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "notifications_title" CHECK ((jsonb_typeof("notifications"."title" -> 'ar') = 'string' and jsonb_typeof("notifications"."title" -> 'en') = 'string') is true),
	CONSTRAINT "notifications_body" CHECK ((jsonb_typeof("notifications"."body" -> 'ar') = 'string' and jsonb_typeof("notifications"."body" -> 'en') = 'string') is true)
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text,
	"reporter_id" text,
	"reason" "report_reason" NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolution_note" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"target_type" "target_type" NOT NULL,
	"target_id" text NOT NULL,
	"author_id" text,
	"author_name" text NOT NULL,
	"rating" integer NOT NULL,
	"body" text,
	"reply_body" text,
	"reply_at" timestamp with time zone,
	"status" "review_status" DEFAULT 'visible' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reviews_authorId_targetType_targetId_unique" UNIQUE("author_id","target_type","target_id"),
	CONSTRAINT "reviews_rating" CHECK ("reviews"."rating" between 1 and 5),
	CONSTRAINT "reviews_reply" CHECK (("reviews"."reply_body" is null) = ("reviews"."reply_at" is null))
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"params" jsonb NOT NULL,
	"alerts" boolean NOT NULL,
	"new_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "saved_searches_new_count" CHECK ("saved_searches"."new_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "verification_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"label" text NOT NULL,
	"upload_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "verification_documents_uploadId_unique" UNIQUE("upload_id"),
	CONSTRAINT "verification_documents_requestId_position_unique" UNIQUE("request_id","position")
);
--> statement-breakpoint
CREATE TABLE "verification_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"target_type" "target_type" NOT NULL,
	"target_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"note" text,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_participants" ADD CONSTRAINT "thread_participants_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_participants" ADD CONSTRAINT "thread_participants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_request_id_verification_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."verification_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "favorites_listing_id_index" ON "favorites" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "messages_thread_id_created_at_index" ON "messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "thread_participants_user_id_index" ON "thread_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_read_at_created_at_index" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "reports_listing_id_index" ON "reports" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "reports_reporter_id_index" ON "reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "reports_status_created_at_index" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reviews_target_type_target_id_index" ON "reviews" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "reviews_status_index" ON "reviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "saved_searches_user_id_index" ON "saved_searches" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_requests_one_pending" ON "verification_requests" USING btree ("target_type","target_id") WHERE "verification_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "verification_requests_owner_id_index" ON "verification_requests" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "verification_requests_status_created_at_index" ON "verification_requests" USING btree ("status","created_at");