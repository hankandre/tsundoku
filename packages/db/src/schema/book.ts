import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { libraries, libraryPaths } from "./library.ts";

export const bookType = ["PDF", "EPUB", "CBX", "MOBI", "AZW3", "FB2", "AUDIOBOOK"] as const;
export type BookType = (typeof bookType)[number];

export const books = pgTable(
  "books",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    libraryId: uuid("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    libraryPathId: uuid("library_path_id")
      .notNull()
      .references(() => libraryPaths.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileSubPath: text("file_sub_path"),
    bookType: varchar("book_type", { length: 32 }).$type<BookType>().notNull(),
    isFolderBased: boolean("is_folder_based").notNull().default(false),
    addedOn: timestamp("added_on", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    scannedOn: timestamp("scanned_on", { withTimezone: true }),
  },
  (t) => [
    index("ix_books_library").on(t.libraryId),
    index("ix_books_library_path").on(t.libraryPathId),
  ],
);

export const authors = pgTable(
  "authors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 512 }).notNull(),
    bio: text("bio"),
    imageUrl: text("image_url"),
  },
  (t) => [uniqueIndex("uq_authors_name").on(t.name)],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 256 }).notNull(),
  },
  (t) => [uniqueIndex("uq_categories_name").on(t.name)],
);

// Booklore stores ~30 per-field "lock" booleans on book_metadata so that a metadata
// refresh won't overwrite a user-edited field. We model the same shape here; the
// originals are in V32+/V117 migrations of the Spring app.
export const bookMetadata = pgTable("book_metadata", {
  bookId: uuid("book_id")
    .primaryKey()
    .references(() => books.id, { onDelete: "cascade" }),

  title: text("title"),
  subtitle: text("subtitle"),
  description: text("description"),
  publisher: varchar("publisher", { length: 256 }),
  publishedDate: varchar("published_date", { length: 32 }),
  isbn10: varchar("isbn_10", { length: 32 }),
  isbn13: varchar("isbn_13", { length: 32 }),
  asin: varchar("asin", { length: 32 }),
  pageCount: integer("page_count"),
  language: varchar("language", { length: 16 }),
  rating: doublePrecision("rating"),
  ageRating: varchar("age_rating", { length: 32 }),
  seriesName: varchar("series_name", { length: 256 }),
  seriesNumber: doublePrecision("series_number"),

  titleLocked: boolean("title_locked").notNull().default(false),
  subtitleLocked: boolean("subtitle_locked").notNull().default(false),
  descriptionLocked: boolean("description_locked").notNull().default(false),
  publisherLocked: boolean("publisher_locked").notNull().default(false),
  publishedDateLocked: boolean("published_date_locked").notNull().default(false),
  isbnLocked: boolean("isbn_locked").notNull().default(false),
  pageCountLocked: boolean("page_count_locked").notNull().default(false),
  languageLocked: boolean("language_locked").notNull().default(false),
  ratingLocked: boolean("rating_locked").notNull().default(false),
  ageRatingLocked: boolean("age_rating_locked").notNull().default(false),
  coverLocked: boolean("cover_locked").notNull().default(false),
  authorsLocked: boolean("authors_locked").notNull().default(false),
  categoriesLocked: boolean("categories_locked").notNull().default(false),
});

export const bookMetadataAuthorMapping = pgTable(
  "book_metadata_author_mapping",
  {
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => authors.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.authorId] })],
);

export const bookMetadataCategoryMapping = pgTable(
  "book_metadata_category_mapping",
  {
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.categoryId] })],
);

// Additional / companion files attached to a book: extras (PDF samples,
// soundtracks, multi-volume sub-files). Distinct from the primary book file
// so users can download just what they want.
export const bookAdditionalFiles = pgTable(
  "book_additional_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 256 }).notNull(),
    fileName: text("file_name").notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    addedOn: timestamp("added_on", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("ix_book_additional_files_book").on(t.bookId)],
);

export const booksRelations = relations(books, ({ one, many }) => ({
  library: one(libraries, {
    fields: [books.libraryId],
    references: [libraries.id],
  }),
  libraryPath: one(libraryPaths, {
    fields: [books.libraryPathId],
    references: [libraryPaths.id],
  }),
  metadata: one(bookMetadata, {
    fields: [books.id],
    references: [bookMetadata.bookId],
  }),
  authors: many(bookMetadataAuthorMapping),
  categories: many(bookMetadataCategoryMapping),
}));
