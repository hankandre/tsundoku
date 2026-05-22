CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'running' NOT NULL,
	"progress" jsonb,
	"detail" text,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ix_tasks_kind_started" ON "tasks" USING btree ("kind","started_at");