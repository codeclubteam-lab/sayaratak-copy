CREATE INDEX "dealerships_lat_lng_index" ON "dealerships" USING btree ("lat","lng");--> statement-breakpoint
CREATE INDEX "workshops_lat_lng_index" ON "workshops" USING btree ("lat","lng");