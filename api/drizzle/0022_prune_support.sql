CREATE TABLE "events_monthly" (
	"month" date NOT NULL,
	"target_id" text NOT NULL,
	"type" "event_type" NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "events_monthly_target_id_month_type_pk" PRIMARY KEY("target_id","month","type"),
	CONSTRAINT "events_monthly_count_positive" CHECK ("events_monthly"."count" > 0)
);
--> statement-breakpoint
CREATE INDEX "events_day_index" ON "events" USING btree ("day");--> statement-breakpoint
CREATE INDEX "devices_last_seen_at_index" ON "devices" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "notifications_read_created" ON "notifications" USING btree ("created_at") WHERE "notifications"."read_at" is not null;--> statement-breakpoint
CREATE INDEX "outbox_sent" ON "outbox" USING btree ("sent_at") WHERE "outbox"."sent_at" is not null;