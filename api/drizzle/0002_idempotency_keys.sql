CREATE TABLE "idempotency_keys" (
	"owner" text NOT NULL,
	"key" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_owner_key_pk" PRIMARY KEY("owner","key")
);
