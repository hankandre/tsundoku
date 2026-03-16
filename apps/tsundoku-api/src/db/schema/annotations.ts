import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const uuidv7 = () => Bun.randomUUIDv7();

export const annotations = pgTable("annotations", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  bookId: uuid("book_id").notNull(),
  cfi: varchar("cfi", { length: 1000 }).notNull(),
  text: varchar("text", { length: 5000 }).notNull(),
  color: varchar("color", { length: 20 }),
  style: varchar("style", { length: 50 }),
  note: varchar("note", { length: 5000 }),
  chapterTitle: varchar("chapter_title", { length: 500 }),
  version: uuid("version").notNull().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("annotations_user_book_cfi_idx").on(table.userId, table.bookId, table.cfi),
  index("annotations_user_created_idx").on(table.userId, table.createdAt.desc()),
  index("annotations_book_idx").on(table.bookId),
  index("annotations_user_book_idx").on(table.userId, table.bookId),
]);

export type Annotation = typeof annotations.$inferSelect;
export type NewAnnotation = typeof annotations.$inferInsert;

export const bookNotesV2 = pgTable("book_notes_v2", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  bookId: uuid("book_id").notNull(),
  cfi: varchar("cfi", { length: 1000 }).notNull(),
  selectedText: varchar("selected_text", { length: 5000 }),
  noteContent: text("note_content").notNull(),
  color: varchar("color", { length: 20 }),
  chapterTitle: varchar("chapter_title", { length: 500 }),
  version: uuid("version").notNull().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("book_notes_v2_user_book_cfi_idx").on(table.userId, table.bookId, table.cfi),
  index("book_notes_v2_user_created_idx").on(table.userId, table.createdAt.desc()),
  index("book_notes_v2_book_idx").on(table.bookId),
  index("book_notes_v2_user_book_idx").on(table.userId, table.bookId),
]);

export type BookNoteV2 = typeof bookNotesV2.$inferSelect;
export type NewBookNoteV2 = typeof bookNotesV2.$inferInsert;

export const pdfAnnotations = pgTable("pdf_annotations", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  bookId: uuid("book_id").notNull(),
  data: text("data").notNull(),
  version: uuid("version").notNull().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("pdf_annotations_user_book_idx").on(table.userId, table.bookId),
  index("pdf_annotations_user_idx").on(table.userId),
  index("pdf_annotations_book_idx").on(table.bookId),
]);

export type PdfAnnotation = typeof pdfAnnotations.$inferSelect;
export type NewPdfAnnotation = typeof pdfAnnotations.$inferInsert;
