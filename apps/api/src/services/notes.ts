import { and, eq, desc } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";

export type NoteInput = {
  cfi?: string | null;
  selectedText?: string | null;
  noteContent?: string | null;
  color?: string | null;
  chapterTitle?: string | null;
};

export async function listNotes(userId: string, bookId: string) {
  const db = requireDb();
  return db
    .select()
    .from(schema.bookNotes)
    .where(and(eq(schema.bookNotes.userId, userId), eq(schema.bookNotes.bookId, bookId)))
    .orderBy(desc(schema.bookNotes.updatedAt));
}

export async function createNote(userId: string, bookId: string, input: NoteInput) {
  const db = requireDb();
  const inserted = await db
    .insert(schema.bookNotes)
    .values({
      userId,
      bookId,
      cfi: input.cfi ?? null,
      selectedText: input.selectedText ?? null,
      noteContent: input.noteContent ?? null,
      color: input.color ?? null,
      chapterTitle: input.chapterTitle ?? null,
    })
    .returning();
  return inserted[0]!;
}

export async function updateNote(userId: string, noteId: string, input: NoteInput) {
  const db = requireDb();
  await db
    .update(schema.bookNotes)
    .set({
      noteContent: input.noteContent ?? null,
      color: input.color ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.bookNotes.id, noteId), eq(schema.bookNotes.userId, userId)));
}

export async function deleteNote(userId: string, noteId: string) {
  const db = requireDb();
  await db
    .delete(schema.bookNotes)
    .where(and(eq(schema.bookNotes.id, noteId), eq(schema.bookNotes.userId, userId)));
}

export async function listBookmarks(userId: string, bookId: string) {
  const db = requireDb();
  return db
    .select()
    .from(schema.bookmarks)
    .where(and(eq(schema.bookmarks.userId, userId), eq(schema.bookmarks.bookId, bookId)))
    .orderBy(desc(schema.bookmarks.createdAt));
}

export async function createBookmark(input: {
  userId: string;
  bookId: string;
  location: string;
  label?: string | null;
}) {
  const db = requireDb();
  const inserted = await db
    .insert(schema.bookmarks)
    .values({
      userId: input.userId,
      bookId: input.bookId,
      location: input.location,
      label: input.label ?? null,
    })
    .returning();
  return inserted[0]!;
}

export async function deleteBookmark(userId: string, bookmarkId: string) {
  const db = requireDb();
  await db
    .delete(schema.bookmarks)
    .where(and(eq(schema.bookmarks.id, bookmarkId), eq(schema.bookmarks.userId, userId)));
}
