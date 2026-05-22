CREATE TABLE "custom_icons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"file_name" varchar(256) NOT NULL,
	"mime_type" varchar(64) NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_icons_name_unique" UNIQUE("name")
);
