import { db, schema } from "../db/client";
import { eq, sql, and, or, ilike, desc, asc } from "drizzle-orm";

const ensureDb = () => {
  if (!db) {
    throw new Error("Database not configured");
  }
  return db;
};

type EntryType = "HIGHLIGHT" | "NOTE" | "BOOKMARK";

const VALID_TYPES: EntryType[] = ["HIGHLIGHT", "NOTE", "BOOKMARK"];

interface RawEntry {
  id: string;
  type: string;
  bookId: string;
  bookTitle: string | null;
  text: string | null;
  note: string | null;
  color: string | null;
  style: string | null;
  chapterTitle: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface NotebookEntry {
  id: string;
  type: EntryType;
  bookId: string;
  bookTitle: string | null;
  text: string | null;
  note: string | null;
  color: string | null;
  style: string | null;
  chapterTitle: string | null;
  primaryBookType: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface NotebookBookOption {
  bookId: string;
  bookTitle: string;
}

export const getNotebookEntries = async (
  userId: string,
  page: number = 0,
  size: number = 50,
  types?: string[],
  bookId?: string,
  search?: string,
  sort: "asc" | "desc" = "desc"
): Promise<{ entries: NotebookEntry[]; total: number }> => {
  const database = ensureDb();

  const pageSize = Math.min(size, 100);
  const offset = page * pageSize;

  const requestedTypes: EntryType[] = types
    ? types.filter((t): t is EntryType => VALID_TYPES.includes(t as EntryType))
    : VALID_TYPES;

  const queries: Promise<RawEntry[]>[] = [];

  if (requestedTypes.includes("HIGHLIGHT")) {
    queries.push(
      database
        .select({
          id: schema.annotations.id,
          type: sql<string>`'HIGHLIGHT'`,
          bookId: schema.annotations.bookId,
          bookTitle: schema.bookMetadata.title,
          text: schema.annotations.text,
          note: schema.annotations.note,
          color: schema.annotations.color,
          style: schema.annotations.style,
          chapterTitle: schema.annotations.chapterTitle,
          createdAt: schema.annotations.createdAt,
          updatedAt: schema.annotations.updatedAt,
        })
        .from(schema.annotations)
        .innerJoin(schema.bookMetadata, eq(schema.annotations.bookId, schema.bookMetadata.bookId))
        .where(
          and(
            eq(schema.annotations.userId, userId),
            bookId ? eq(schema.annotations.bookId, bookId) : undefined,
            search
              ? or(
                  ilike(schema.annotations.text, `%${search}%`),
                  ilike(schema.annotations.note, `%${search}%`),
                  ilike(schema.annotations.chapterTitle, `%${search}%`)
                )
              : undefined
          )
        )
        .orderBy(sort === "desc" ? desc(schema.annotations.createdAt) : asc(schema.annotations.createdAt))
        .limit(pageSize + offset)
    );
  }

  if (requestedTypes.includes("NOTE")) {
    queries.push(
      database
        .select({
          id: schema.bookNotesV2.id,
          type: sql<string>`'NOTE'`,
          bookId: schema.bookNotesV2.bookId,
          bookTitle: schema.bookMetadata.title,
          text: schema.bookNotesV2.selectedText,
          note: schema.bookNotesV2.noteContent,
          color: schema.bookNotesV2.color,
          style: sql<string | null>`null`,
          chapterTitle: schema.bookNotesV2.chapterTitle,
          createdAt: schema.bookNotesV2.createdAt,
          updatedAt: schema.bookNotesV2.updatedAt,
        })
        .from(schema.bookNotesV2)
        .innerJoin(schema.bookMetadata, eq(schema.bookNotesV2.bookId, schema.bookMetadata.bookId))
        .where(
          and(
            eq(schema.bookNotesV2.userId, userId),
            bookId ? eq(schema.bookNotesV2.bookId, bookId) : undefined,
            search
              ? or(
                  ilike(schema.bookNotesV2.selectedText, `%${search}%`),
                  ilike(schema.bookNotesV2.noteContent, `%${search}%`),
                  ilike(schema.bookNotesV2.chapterTitle, `%${search}%`)
                )
              : undefined
          )
        )
        .orderBy(sort === "desc" ? desc(schema.bookNotesV2.createdAt) : asc(schema.bookNotesV2.createdAt))
        .limit(pageSize + offset)
    );
  }

  if (requestedTypes.includes("BOOKMARK")) {
    queries.push(
      database
        .select({
          id: schema.bookMarks.id,
          type: sql<string>`'BOOKMARK'`,
          bookId: schema.bookMarks.bookId,
          bookTitle: schema.bookMetadata.title,
          text: schema.bookMarks.title,
          note: sql<string | null>`null`,
          color: sql<string | null>`null`,
          style: sql<string | null>`null`,
          chapterTitle: sql<string | null>`null`,
          createdAt: schema.bookMarks.createdAt,
          updatedAt: sql<Date | null>`null`,
        })
        .from(schema.bookMarks)
        .innerJoin(schema.bookMetadata, eq(schema.bookMarks.bookId, schema.bookMetadata.bookId))
        .where(
          and(
            eq(schema.bookMarks.userId, userId),
            bookId ? eq(schema.bookMarks.bookId, bookId) : undefined
          )
        )
        .orderBy(sort === "desc" ? desc(schema.bookMarks.createdAt) : asc(schema.bookMarks.createdAt))
        .limit(pageSize + offset)
    );
  }

  const results = await Promise.all(queries);
  const allEntries = results.flat();

  allEntries.sort((a, b) => {
    const dateA = a.createdAt?.getTime() ?? 0;
    const dateB = b.createdAt?.getTime() ?? 0;
    return sort === "desc" ? dateB - dateA : dateA - dateB;
  });

  const total = allEntries.length;
  const paginated = allEntries.slice(offset, offset + pageSize);

  return {
    entries: paginated.map((row): NotebookEntry => ({
      id: row.id,
      type: row.type as EntryType,
      bookId: row.bookId,
      bookTitle: row.bookTitle,
      text: row.text,
      note: row.note,
      color: row.color,
      style: row.style,
      chapterTitle: row.chapterTitle,
      primaryBookType: null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    total,
  };
};

export const exportNotebookEntries = async (
  userId: string,
  types?: string[],
  bookId?: string,
  search?: string,
  sort: "asc" | "desc" = "desc"
): Promise<NotebookEntry[]> => {
  const result = await getNotebookEntries(userId, 0, 50000, types, bookId, search, sort);
  return result.entries;
};

export const getBooksWithAnnotations = async (
  userId: string,
  search?: string
): Promise<NotebookBookOption[]> => {
  const database = ensureDb();

  const [annotationBooks, noteBooks, bookmarkBooks] = await Promise.all([
    database
      .select({
        bookId: schema.annotations.bookId,
        bookTitle: schema.bookMetadata.title,
      })
      .from(schema.annotations)
      .innerJoin(schema.bookMetadata, eq(schema.annotations.bookId, schema.bookMetadata.bookId))
      .where(eq(schema.annotations.userId, userId)),
    database
      .select({
        bookId: schema.bookNotesV2.bookId,
        bookTitle: schema.bookMetadata.title,
      })
      .from(schema.bookNotesV2)
      .innerJoin(schema.bookMetadata, eq(schema.bookNotesV2.bookId, schema.bookMetadata.bookId))
      .where(eq(schema.bookNotesV2.userId, userId)),
    database
      .select({
        bookId: schema.bookMarks.bookId,
        bookTitle: schema.bookMetadata.title,
      })
      .from(schema.bookMarks)
      .innerJoin(schema.bookMetadata, eq(schema.bookMarks.bookId, schema.bookMetadata.bookId))
      .where(eq(schema.bookMarks.userId, userId)),
  ]);

  const uniqueBooks = new Map<string, string>();

  for (const book of [...annotationBooks, ...noteBooks, ...bookmarkBooks]) {
    if (!uniqueBooks.has(book.bookId)) {
      if (search) {
        if (book.bookTitle && book.bookTitle.toLowerCase().includes(search.toLowerCase())) {
          uniqueBooks.set(book.bookId, book.bookTitle);
        }
      } else {
        uniqueBooks.set(book.bookId, book.bookTitle ?? "");
      }
    }
  }

  return Array.from(uniqueBooks.entries())
    .map(([bookId, bookTitle]) => ({ bookId, bookTitle }))
    .sort((a, b) => a.bookTitle.localeCompare(b.bookTitle))
    .slice(0, 50);
};
