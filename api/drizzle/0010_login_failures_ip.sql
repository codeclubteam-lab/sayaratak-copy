-- Failure rows only live 10 minutes to an hour and carry no IP yet; dropping them lets the column be NOT NULL.
DELETE FROM "login_failures";--> statement-breakpoint
ALTER TABLE "login_failures" ADD COLUMN "ip" text NOT NULL;
