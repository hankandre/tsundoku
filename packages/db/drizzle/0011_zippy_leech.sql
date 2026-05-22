CREATE TABLE "hardcover_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"api_token" text,
	"sync_enabled" boolean DEFAULT false NOT NULL,
	"last_sync_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "hardcover_settings" ADD CONSTRAINT "hardcover_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;