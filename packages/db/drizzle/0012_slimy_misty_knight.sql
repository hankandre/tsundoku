CREATE TABLE "komga_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"base_url" text,
	"username" varchar(256),
	"password" text,
	"last_sync_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "komga_settings" ADD CONSTRAINT "komga_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;