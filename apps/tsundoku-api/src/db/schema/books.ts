import {
  boolean,
  date,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

const uuidv7 = () => Bun.randomUUIDv7();

export const books = pgTable("books", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSubPath: varchar("file_sub_path", { length: 512 }).notNull(),
  bookType: varchar("book_type", { length: 6 }).notNull(),
  isPhysical: boolean("is_physical").notNull().default(false),
  libraryId: uuid("library_id").notNull(),
  libraryPathId: uuid("library_path_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("books_file_library_idx").on(table.fileName, table.libraryId),
  index("books_library_idx").on(table.libraryId),
]);

export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;

export const bookMetadata = pgTable("book_metadata", {
  bookId: uuid("book_id").primaryKey(),
  title: varchar("title", { length: 255 }),
  subtitle: varchar("subtitle", { length: 255 }),
  publisher: varchar("publisher", { length: 255 }),
  publishedDate: date("published_date"),
  description: text("description"),
  isbn13: varchar("isbn_13", { length: 20 }),
  isbn10: varchar("isbn_10", { length: 20 }),
  pageCount: integer("page_count"),
  thumbnail: varchar("thumbnail", { length: 1000 }),
  language: varchar("language", { length: 10 }),
  rating: integer("rating"),
  reviewCount: integer("review_count"),
  cover: varchar("cover", { length: 255 }),
  coverUpdatedOn: timestamp("cover_updated_on", { withTimezone: true }),
  seriesName: varchar("series_name", { length: 255 }),
  seriesNumber: integer("series_number"),
  seriesTotal: integer("series_total"),
  allFieldsLocked: boolean("all_fields_locked").default(false),
  titleLocked: boolean("title_locked").default(false),
  authorsLocked: boolean("authors_locked").default(false),
  categoriesLocked: boolean("categories_locked").default(false),
  subtitleLocked: boolean("subtitle_locked").default(false),
  publisherLocked: boolean("publisher_locked").default(false),
  publishedDateLocked: boolean("published_date_locked").default(false),
  descriptionLocked: boolean("description_locked").default(false),
  isbn13Locked: boolean("isbn_13_locked").default(false),
  isbn10Locked: boolean("isbn_10_locked").default(false),
  pageCountLocked: boolean("page_count_locked").default(false),
  thumbnailLocked: boolean("thumbnail_locked").default(false),
  languageLocked: boolean("language_locked").default(false),
  coverLocked: boolean("cover_locked").default(false),
  ratingLocked: boolean("rating_locked").default(false),
  reviewCountLocked: boolean("review_count_locked").default(false),
  seriesNameLocked: boolean("series_name_locked").default(false),
  seriesNumberLocked: boolean("series_number_locked").default(false),
  seriesTotalLocked: boolean("series_total_locked").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type BookMetadata = typeof bookMetadata.$inferSelect;
export type NewBookMetadata = typeof bookMetadata.$inferInsert;

export const authors = pgTable("authors", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("authors_name_idx").on(table.name),
]);

export type Author = typeof authors.$inferSelect;
export type NewAuthor = typeof authors.$inferInsert;

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("categories_name_idx").on(table.name),
]);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export const bookMetadataAuthorMapping = pgTable(
  "book_metadata_author_mapping",
  {
    bookId: uuid("book_id").notNull(),
    authorId: uuid("author_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.bookId, table.authorId] }),
    index("book_metadata_author_mapping_book_idx").on(table.bookId),
    index("book_metadata_author_mapping_author_idx").on(table.authorId),
  ]
);

export type BookMetadataAuthorMapping = typeof bookMetadataAuthorMapping.$inferSelect;
export type NewBookMetadataAuthorMapping = typeof bookMetadataAuthorMapping.$inferInsert;

export const bookMetadataCategoryMapping = pgTable(
  "book_metadata_category_mapping",
  {
    bookId: uuid("book_id").notNull(),
    categoryId: uuid("category_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.bookId, table.categoryId] }),
  ]
);

export type BookMetadataCategoryMapping = typeof bookMetadataCategoryMapping.$inferSelect;
export type NewBookMetadataCategoryMapping = typeof bookMetadataCategoryMapping.$inferInsert;

export const bookAwards = pgTable("book_awards", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  bookId: uuid("book_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull(),
  category: varchar("category", { length: 255 }).notNull(),
  designation: varchar("designation", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("book_awards_book_idx").on(table.bookId, table.name, table.category, table.awardedAt),
]);

export type BookAward = typeof bookAwards.$inferSelect;
export type NewBookAward = typeof bookAwards.$inferInsert;
