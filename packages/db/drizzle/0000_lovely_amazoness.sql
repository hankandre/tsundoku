CREATE TABLE "user_content_restriction" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"max_age_rating" varchar(32)
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"upload" boolean DEFAULT false NOT NULL,
	"download" boolean DEFAULT true NOT NULL,
	"edit_metadata" boolean DEFAULT false NOT NULL,
	"manipulate_library" boolean DEFAULT false NOT NULL,
	"admin" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid NOT NULL,
	"setting_key" varchar(128) NOT NULL,
	"setting_value" jsonb,
	CONSTRAINT "user_settings_user_id_setting_key_pk" PRIMARY KEY("user_id","setting_key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(128) NOT NULL,
	"password_hash" text,
	"name" varchar(256),
	"email" varchar(256),
	"oidc_subject" varchar(256),
	"oidc_issuer" varchar(256),
	"avatar_url" text,
	"book_preferences" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oidc_group_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_name" varchar(256) NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"library_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "oidc_group_mappings_group_name_unique" UNIQUE("group_name")
);
--> statement-breakpoint
CREATE TABLE "oidc_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"oidc_subject" varchar(256) NOT NULL,
	"oidc_issuer" varchar(256) NOT NULL,
	"oidc_session_id" varchar(256),
	"id_token_hint" text,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expiry_date" timestamp (6) with time zone NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"revocation_date" timestamp (6) with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "libraries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256) NOT NULL,
	"icon" varchar(128),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"organization_mode" varchar(32) DEFAULT 'BOOK_PER_FILE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"library_id" uuid NOT NULL,
	"path" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_library_mapping" (
	"user_id" uuid NOT NULL,
	"library_id" uuid NOT NULL,
	CONSTRAINT "user_library_mapping_user_id_library_id_pk" PRIMARY KEY("user_id","library_id")
);
--> statement-breakpoint
CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(512) NOT NULL,
	"bio" text,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "book_metadata" (
	"book_id" uuid PRIMARY KEY NOT NULL,
	"title" text,
	"subtitle" text,
	"description" text,
	"publisher" varchar(256),
	"published_date" varchar(32),
	"isbn_10" varchar(32),
	"isbn_13" varchar(32),
	"asin" varchar(32),
	"page_count" integer,
	"language" varchar(16),
	"rating" double precision,
	"age_rating" varchar(32),
	"title_locked" boolean DEFAULT false NOT NULL,
	"subtitle_locked" boolean DEFAULT false NOT NULL,
	"description_locked" boolean DEFAULT false NOT NULL,
	"publisher_locked" boolean DEFAULT false NOT NULL,
	"published_date_locked" boolean DEFAULT false NOT NULL,
	"isbn_locked" boolean DEFAULT false NOT NULL,
	"page_count_locked" boolean DEFAULT false NOT NULL,
	"language_locked" boolean DEFAULT false NOT NULL,
	"rating_locked" boolean DEFAULT false NOT NULL,
	"age_rating_locked" boolean DEFAULT false NOT NULL,
	"cover_locked" boolean DEFAULT false NOT NULL,
	"authors_locked" boolean DEFAULT false NOT NULL,
	"categories_locked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_metadata_author_mapping" (
	"book_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	CONSTRAINT "book_metadata_author_mapping_book_id_author_id_pk" PRIMARY KEY("book_id","author_id")
);
--> statement-breakpoint
CREATE TABLE "book_metadata_category_mapping" (
	"book_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "book_metadata_category_mapping_book_id_category_id_pk" PRIMARY KEY("book_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"library_id" uuid NOT NULL,
	"library_path_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_sub_path" text,
	"book_type" varchar(32) NOT NULL,
	"is_folder_based" boolean DEFAULT false NOT NULL,
	"added_on" timestamp with time zone DEFAULT now() NOT NULL,
	"scanned_on" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_shelf_mapping" (
	"book_id" uuid NOT NULL,
	"shelf_id" uuid NOT NULL,
	CONSTRAINT "book_shelf_mapping_book_id_shelf_id_pk" PRIMARY KEY("book_id","shelf_id")
);
--> statement-breakpoint
CREATE TABLE "magic_shelves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"rules" jsonb
);
--> statement-breakpoint
CREATE TABLE "shelves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"icon" varchar(128),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(128) NOT NULL,
	"name" varchar(128) NOT NULL,
	"val" jsonb
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"username" varchar(128),
	"action" varchar(64) NOT NULL,
	"entity_type" varchar(64),
	"entity_id" varchar(128),
	"ip_address" varchar(64),
	"country_code" varchar(8),
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"cfi" text,
	"selected_text" text,
	"note_content" text,
	"color" varchar(16),
	"chapter_title" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"location" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pdf_annotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"page" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"duration_seconds" integer,
	"start_location" text,
	"end_location" text
);
--> statement-breakpoint
CREATE TABLE "user_book_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"pdf_progress" integer,
	"epub_progress" text,
	"audiobook_progress_seconds" integer,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_content_restriction" ADD CONSTRAINT "user_content_restriction_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_sessions" ADD CONSTRAINT "oidc_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_paths" ADD CONSTRAINT "library_paths_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library_mapping" ADD CONSTRAINT "user_library_mapping_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library_mapping" ADD CONSTRAINT "user_library_mapping_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_metadata" ADD CONSTRAINT "book_metadata_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_metadata_author_mapping" ADD CONSTRAINT "book_metadata_author_mapping_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_metadata_author_mapping" ADD CONSTRAINT "book_metadata_author_mapping_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_metadata_category_mapping" ADD CONSTRAINT "book_metadata_category_mapping_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_metadata_category_mapping" ADD CONSTRAINT "book_metadata_category_mapping_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_library_path_id_library_paths_id_fk" FOREIGN KEY ("library_path_id") REFERENCES "public"."library_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_shelf_mapping" ADD CONSTRAINT "book_shelf_mapping_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_shelf_mapping" ADD CONSTRAINT "book_shelf_mapping_shelf_id_shelves_id_fk" FOREIGN KEY ("shelf_id") REFERENCES "public"."shelves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_shelves" ADD CONSTRAINT "magic_shelves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelves" ADD CONSTRAINT "shelves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_notes" ADD CONSTRAINT "book_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_notes" ADD CONSTRAINT "book_notes_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdf_annotations" ADD CONSTRAINT "pdf_annotations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdf_annotations" ADD CONSTRAINT "pdf_annotations_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_book_progress" ADD CONSTRAINT "user_book_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_book_progress" ADD CONSTRAINT "user_book_progress_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_oidc_issuer_subject" ON "users" USING btree ("oidc_issuer","oidc_subject");--> statement-breakpoint
CREATE INDEX "ix_oidc_sessions_user" ON "oidc_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_oidc_sessions_sub_iss" ON "oidc_sessions" USING btree ("oidc_subject","oidc_issuer");--> statement-breakpoint
CREATE INDEX "ix_oidc_sessions_sid" ON "oidc_sessions" USING btree ("oidc_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_refresh_tokens_token" ON "refresh_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "ix_refresh_tokens_user" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_library_paths_library" ON "library_paths" USING btree ("library_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_authors_name" ON "authors" USING btree ("name");--> statement-breakpoint
CREATE INDEX "ix_books_library" ON "books" USING btree ("library_id");--> statement-breakpoint
CREATE INDEX "ix_books_library_path" ON "books" USING btree ("library_path_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_categories_name" ON "categories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "ix_magic_shelves_user" ON "magic_shelves" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_shelves_user" ON "shelves" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_app_settings_category_name" ON "app_settings" USING btree ("category","name");--> statement-breakpoint
CREATE INDEX "ix_book_notes_user_book" ON "book_notes" USING btree ("user_id","book_id");--> statement-breakpoint
CREATE INDEX "ix_book_notes_book" ON "book_notes" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "ix_bookmarks_user_book" ON "bookmarks" USING btree ("user_id","book_id");--> statement-breakpoint
CREATE INDEX "ix_pdf_annotations_user_book" ON "pdf_annotations" USING btree ("user_id","book_id");--> statement-breakpoint
CREATE INDEX "ix_reading_sessions_user_book" ON "reading_sessions" USING btree ("user_id","book_id");--> statement-breakpoint
CREATE INDEX "ix_reading_sessions_start" ON "reading_sessions" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "ix_user_book_progress_user_book" ON "user_book_progress" USING btree ("user_id","book_id");