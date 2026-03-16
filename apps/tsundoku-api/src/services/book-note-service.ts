import { db, schema } from "../db/client";
import { eq, and } from "drizzle-orm";
import { fail } from "../http/errors";
import type { BookNoteV2 } from "../db/schema/annotations";

type BookNoteRow = BookNoteV2;

const ensureDb = () => {
  if (!db) {
    throw new Error("Database not configured");
  }
  return db;
};

export const getNotesForBook = async (bookId: string, userId: string): Promise<BookNoteRow[]> => {
  const database = ensureDb();
  
  return await database
    .select()
    .from(schema.bookNotesV2)
    .where(and(
      eq(schema.bookNotesV2.bookId, bookId),
      eq(schema.bookNotesV2.userId, userId)
    ));
};

export const getNoteById = async (noteId: string, userId: string): Promise<BookNoteRow | null> => {
  const database = ensureDb();
  
  const result = await database
    .select()
    .from(schema.bookNotesV2)
    .where(and(
      eq(schema.bookNotesV2.id, noteId),
      eq(schema.bookNotesV2.userId, userId)
    ));
  
  return result[0] ?? null;
};

export interface CreateNoteInput {
  bookId: string;
  cfi?: string;
  text: string;
}

export const createNote = async (userId: string, input: CreateNoteInput): Promise<BookNoteRow> => {
  const database = ensureDb();
  
  await database.insert(schema.bookNotesV2).values({
    userId,
    bookId: input.bookId,
    cfi: input.cfi || "",
    noteContent: input.text,
    createdBy: userId,
  });
  
  const result = await database
    .select()
    .from(schema.bookNotesV2)
    .where(and(eq(schema.bookNotesV2.bookId, input.bookId), eq(schema.bookNotesV2.userId, userId)));
  
  return result[0] as BookNoteRow;
};

export const updateNote = async (
  noteId: string,
  userId: string,
  input: { cfi?: string; text?: string }
): Promise<BookNoteRow> => {
  const database = ensureDb();
  
  const existing = await database
    .select()
    .from(schema.bookNotesV2)
    .where(and(
      eq(schema.bookNotesV2.id, noteId),
      eq(schema.bookNotesV2.userId, userId)
    ));
  
  if (!existing[0]) {
    fail(404, `Note not found: ${noteId}`);
  }
  
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.cfi !== undefined) updateData.cfi = input.cfi;
  if (input.text !== undefined) updateData.noteContent = input.text;
  
  await database
    .update(schema.bookNotesV2)
    .set(updateData)
    .where(eq(schema.bookNotesV2.id, noteId));
  
  const result = await database.select().from(schema.bookNotesV2).where(eq(schema.bookNotesV2.id, noteId));
  return result[0] as BookNoteRow;
};

export const deleteNote = async (noteId: string, userId: string): Promise<void> => {
  const database = ensureDb();
  
  const existing = await database
    .select()
    .from(schema.bookNotesV2)
    .where(and(
      eq(schema.bookNotesV2.id, noteId),
      eq(schema.bookNotesV2.userId, userId)
    ));
  
  if (!existing[0]) {
    fail(404, `Note not found: ${noteId}`);
  }
  
  await database.delete(schema.bookNotesV2).where(eq(schema.bookNotesV2.id, noteId));
};
