-- Full-text search support on book_metadata.
--
-- A `search_vector` column is maintained as a generated tsvector covering
-- title, subtitle, description, publisher, and series name. A GIN index makes
-- `@@ websearch_to_tsquery(...)` fast.
ALTER TABLE "book_metadata"
ADD COLUMN "search_vector" tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("subtitle", '')), 'B') ||
  setweight(to_tsvector('simple', coalesce("series_name", '')), 'B') ||
  setweight(to_tsvector('simple', coalesce("publisher", '')), 'C') ||
  setweight(to_tsvector('simple', coalesce("description", '')), 'D')
) STORED;
--> statement-breakpoint
CREATE INDEX "ix_book_metadata_search_vector" ON "book_metadata" USING gin("search_vector");
