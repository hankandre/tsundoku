import { db, schema } from "../db/client";
import { eq, and } from "drizzle-orm";
import { fail } from "../http/errors";

export interface BookMarkRow {
  id: string;
  userId: string;
  bookId: string;
  cfi: string;
  title: string | null;
  createdAt: Date;
}

const ensureDb = () => {
  if (!db) {
    throw new Error("Database not configured");
  }
  return db;
};

export const getBookmarksForBook = async (bookId: string, userId: string): Promise<BookMarkRow[]> => {
  const database = ensureDb();
  
  return await database
    .select()
    .from(schema.bookMarks)
    .where(and(
      eq(schema.bookMarks.bookId, bookId),
      eq(schema.bookMarks.userId, userId)
    ));
};

export const getBookmarkById = async (bookmarkId: string, userId: string): Promise<BookMarkRow | null> => {
  const database = ensureDb();
  
  const result = await database
    .select()
    .from(schema.bookMarks)
    .where(and(
      eq(schema.bookMarks.id, bookmarkId),
      eq(schema.bookMarks.userId, userId)
    ));
  
  return result[0] ?? null;
};

export interface CreateBookmarkInput {
  bookId: string;
  cfi: string;
  title?: string;
}

export const createBookmark = async (userId: string, input: CreateBookmarkInput): Promise<BookMarkRow> => {
  const database = ensureDb();
  
  const bookmarkId = Bun.randomUUIDv7();
  
  await database.insert(schema.bookMarks).values({
    id: bookmarkId,
    userId,
    bookId: input.bookId,
    cfi: input.cfi,
    title: input.title ?? null,
    createdBy: userId,
  });
  
  const result = await database.select().from(schema.bookMarks).where(eq(schema.bookMarks.id, bookmarkId));
  return result[0] as BookMarkRow;
};

export interface UpdateBookmarkInput {
  cfi?: string;
  title?: string;
}

export const updateBookmark = async (
  bookmarkId: string,
  userId: string,
  input: UpdateBookmarkInput
): Promise<BookMarkRow> => {
  const database = ensureDb();
  
  const existing = await database
    .select()
    .from(schema.bookMarks)
    .where(and(
      eq(schema.bookMarks.id, bookmarkId),
      eq(schema.bookMarks.userId, userId)
    ));
  
  if (!existing[0]) {
    fail(404, `Bookmark not found: ${bookmarkId}`);
  }
  
  const updateData: Record<string, unknown> = {};
  if (input.cfi !== undefined) updateData.cfi = input.cfi;
  if (input.title !== undefined) updateData.title = input.title;
  
  await database
    .update(schema.bookMarks)
    .set(updateData)
    .where(eq(schema.bookMarks.id, bookmarkId));
  
  const result = await database.select().from(schema.bookMarks).where(eq(schema.bookMarks.id, bookmarkId));
  return result[0] as BookMarkRow;
};

export const deleteBookmark = async (bookmarkId: string, userId: string): Promise<void> => {
  const database = ensureDb();
  
  const existing = await database
    .select()
    .from(schema.bookMarks)
    .where(and(
      eq(schema.bookMarks.id, bookmarkId),
      eq(schema.bookMarks.userId, userId)
    ));
  
  if (!existing[0]) {
    fail(404, `Bookmark not found: ${bookmarkId}`);
  }
  
  await database.delete(schema.bookMarks).where(eq(schema.bookMarks.id, bookmarkId));
};
