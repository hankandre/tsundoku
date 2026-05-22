import {
  pgTable,
  uuid,
  integer,
  text,
  varchar,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.ts";
import { books } from "./book.ts";

// Highlights / notes / annotations attached to a book by a user.
// Mirrors Booklore's `book_notes_v2` (V96) shape.
export const bookNotes = pgTable(
  "book_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    cfi: text("cfi"), // EPUB Canonical Fragment Identifier
    selectedText: text("selected_text"),
    noteContent: text("note_content"),
    color: varchar("color", { length: 16 }),
    chapterTitle: text("chapter_title"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("ix_book_notes_user_book").on(t.userId, t.bookId),
    index("ix_book_notes_book").on(t.bookId),
  ],
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    location: text("location").notNull(), // CFI / page / time offset depending on format
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("ix_bookmarks_user_book").on(t.userId, t.bookId)],
);

export const pdfAnnotations = pgTable(
  "pdf_annotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    page: integer("page").notNull(),
    payload: jsonb("payload").notNull(), // PDF.js annotation object
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("ix_pdf_annotations_user_book").on(t.userId, t.bookId)],
);

// One row per (user, book) — coarse position; per-file detail in user_book_file_progress.
export const userBookProgress = pgTable(
  "user_book_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    pdfProgress: integer("pdf_progress"),
    epubProgress: text("epub_progress"),
    audiobookProgressSeconds: integer("audiobook_progress_seconds"),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("ix_user_book_progress_user_book").on(t.userId, t.bookId)],
);

export const bookReviews = pgTable(
  "book_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    rating: integer("rating"),
    title: text("title"),
    body: text("body").notNull(),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("ix_book_reviews_book").on(t.bookId), index("ix_book_reviews_user").on(t.userId)],
);

export const notebookEntries = pgTable(
  "notebook_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: uuid("book_id").references(() => books.id, { onDelete: "set null" }),
    title: text("title"),
    content: text("content").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("ix_notebook_entries_user").on(t.userId)],
);

export const readingSessions = pgTable(
  "reading_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    startLocation: text("start_location"),
    endLocation: text("end_location"),
  },
  (t) => [
    index("ix_reading_sessions_user_book").on(t.userId, t.bookId),
    index("ix_reading_sessions_start").on(t.startTime),
  ],
);
