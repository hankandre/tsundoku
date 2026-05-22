ALTER TABLE "magic_shelves" ALTER COLUMN "rules" SET DEFAULT '{"type":"group","join":"and","rules":[]}'::jsonb;--> statement-breakpoint
ALTER TABLE "magic_shelves" ALTER COLUMN "rules" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "magic_shelves" ADD COLUMN "icon" varchar(128);--> statement-breakpoint
ALTER TABLE "magic_shelves" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "magic_shelves" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "magic_shelves" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_magic_shelves_user_name" ON "magic_shelves" USING btree ("user_id","name");