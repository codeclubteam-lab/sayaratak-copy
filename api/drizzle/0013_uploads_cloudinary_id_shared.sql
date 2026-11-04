DROP INDEX "uploads_cloudinary_id_index";--> statement-breakpoint
CREATE INDEX "uploads_cloudinary_id_index" ON "uploads" USING btree ("cloudinary_id");