import { eq } from "drizzle-orm";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";

export type ResolvedBookFile = {
  bookId: string;
  bookType: schema.BookType;
  absolutePath: string;
  contentType: string;
  filename: string;
};

const CONTENT_TYPES: Record<string, string> = {
  PDF: "application/pdf",
  EPUB: "application/epub+zip",
  CBX: "application/vnd.comicbook+zip",
  MOBI: "application/x-mobipocket-ebook",
  AZW3: "application/vnd.amazon.ebook",
  FB2: "application/x-fictionbook+xml",
  AUDIOBOOK: "audio/mpeg",
};

export async function resolveBookFile(bookId: string): Promise<ResolvedBookFile | null> {
  const db = requireDb();
  const rows = await db
    .select({
      book: schema.books,
      libPath: schema.libraryPaths.path,
    })
    .from(schema.books)
    .innerJoin(schema.libraryPaths, eq(schema.libraryPaths.id, schema.books.libraryPathId))
    .where(eq(schema.books.id, bookId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const fileSub = row.book.fileSubPath ?? "";
  const abs = path.join(row.libPath, fileSub, row.book.fileName);
  return {
    bookId,
    bookType: row.book.bookType,
    absolutePath: abs,
    contentType: CONTENT_TYPES[row.book.bookType] ?? "application/octet-stream",
    filename: row.book.fileName,
  };
}

export async function statFile(absPath: string): Promise<{ size: number } | null> {
  try {
    const s = await fs.stat(absPath);
    return { size: s.size };
  } catch {
    return null;
  }
}
