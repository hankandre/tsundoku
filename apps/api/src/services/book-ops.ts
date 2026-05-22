import { and, eq, inArray, sql, desc } from "drizzle-orm";
import * as fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { resolveBookFile } from "./files.ts";

/**
 * Book operations that aren't pure reads — bulk progress, status flags,
 * rating, recommendations, duplicate detection, file metadata.
 *
 * Booklore's BookController bundles ~20 of these on top of basic CRUD;
 * grouping them in a service keeps routes/books.ts focused on routing.
 */

export async function getBookFileMetadata(bookId: string): Promise<{
  size: number;
  mtime: Date;
  sha256: string;
} | null> {
  const resolved = await resolveBookFile(bookId);
  if (!resolved) return null;
  const stat = await fs.stat(resolved.absolutePath).catch(() => null);
  if (!stat) return null;
  // sha256 over the whole file. Heavy but correct; cache externally if perf matters.
  const buf = await Bun.file(resolved.absolutePath).arrayBuffer();
  const hash = createHash("sha256").update(new Uint8Array(buf)).digest("hex");
  return { size: stat.size, mtime: stat.mtime, sha256: hash };
}

export async function setReadStatus(
  userId: string,
  updates: Array<{ bookId: string; status: "READING" | "FINISHED" | "UNREAD" }>,
): Promise<void> {
  if (updates.length === 0) return;
  const db = requireDb();
  // For each update: upsert userBookProgress, set finishedAt depending on status.
  // UNREAD clears the row entirely.
  await Promise.all(
    updates.map(async ({ bookId, status }) => {
      if (status === "UNREAD") {
        await db
          .delete(schema.userBookProgress)
          .where(
            and(
              eq(schema.userBookProgress.userId, userId),
              eq(schema.userBookProgress.bookId, bookId),
            ),
          );
        return;
      }
      const existing = await db
        .select()
        .from(schema.userBookProgress)
        .where(
          and(
            eq(schema.userBookProgress.userId, userId),
            eq(schema.userBookProgress.bookId, bookId),
          ),
        )
        .limit(1);
      const finishedAt = status === "FINISHED" ? new Date() : null;
      if (existing.length === 0) {
        await db.insert(schema.userBookProgress).values({
          userId,
          bookId,
          finishedAt,
        });
      } else {
        await db
          .update(schema.userBookProgress)
          .set({ finishedAt, updatedAt: new Date() })
          .where(eq(schema.userBookProgress.id, existing[0]!.id));
      }
    }),
  );
}

export async function resetProgressForBooks(userId: string, bookIds: string[]): Promise<void> {
  if (bookIds.length === 0) return;
  const db = requireDb();
  await db
    .delete(schema.userBookProgress)
    .where(
      and(
        eq(schema.userBookProgress.userId, userId),
        inArray(schema.userBookProgress.bookId, bookIds),
      ),
    );
}

export async function setRating(bookId: string, rating: number | null): Promise<void> {
  const db = requireDb();
  const existing = await db
    .select()
    .from(schema.bookMetadata)
    .where(eq(schema.bookMetadata.bookId, bookId))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(schema.bookMetadata).values({ bookId, rating });
  } else {
    await db
      .update(schema.bookMetadata)
      .set({ rating })
      .where(eq(schema.bookMetadata.bookId, bookId));
  }
}

export async function resetRatingForBooks(bookIds: string[]): Promise<void> {
  if (bookIds.length === 0) return;
  const db = requireDb();
  await db
    .update(schema.bookMetadata)
    .set({ rating: null })
    .where(inArray(schema.bookMetadata.bookId, bookIds));
}

export async function findRecommendations(bookId: string, limit = 10): Promise<string[]> {
  const db = requireDb();
  // Strategy: books sharing author or series, ranked by overlap. Cheap and
  // useful; better recommendation rules can layer on later.
  const target = await db
    .select({
      seriesName: schema.bookMetadata.seriesName,
    })
    .from(schema.bookMetadata)
    .where(eq(schema.bookMetadata.bookId, bookId))
    .limit(1);
  const targetSeries = target[0]?.seriesName ?? null;

  const targetAuthorIds = await db
    .select({ authorId: schema.bookMetadataAuthorMapping.authorId })
    .from(schema.bookMetadataAuthorMapping)
    .where(eq(schema.bookMetadataAuthorMapping.bookId, bookId));
  const authorIds = targetAuthorIds.map((r) => r.authorId);

  const candidates = new Set<string>();
  if (targetSeries) {
    const sameSeries = await db
      .select({ bookId: schema.bookMetadata.bookId })
      .from(schema.bookMetadata)
      .where(eq(schema.bookMetadata.seriesName, targetSeries));
    for (const r of sameSeries) if (r.bookId !== bookId) candidates.add(r.bookId);
  }
  if (authorIds.length) {
    const sameAuthor = await db
      .select({ bookId: schema.bookMetadataAuthorMapping.bookId })
      .from(schema.bookMetadataAuthorMapping)
      .where(inArray(schema.bookMetadataAuthorMapping.authorId, authorIds));
    for (const r of sameAuthor) if (r.bookId !== bookId) candidates.add(r.bookId);
  }
  return [...candidates].slice(0, limit);
}

export async function findDuplicates(): Promise<
  Array<{ key: string; bookIds: string[] }>
> {
  const db = requireDb();
  // Match by ISBN-13 first; fall back to ISBN-10. Books with neither are skipped.
  const rows = await db
    .select({
      bookId: schema.bookMetadata.bookId,
      isbn13: schema.bookMetadata.isbn13,
      isbn10: schema.bookMetadata.isbn10,
    })
    .from(schema.bookMetadata)
    .where(
      sql`${schema.bookMetadata.isbn13} is not null or ${schema.bookMetadata.isbn10} is not null`,
    );
  const groups = new Map<string, string[]>();
  for (const r of rows) {
    const key = r.isbn13 ?? r.isbn10!;
    const list = groups.get(key) ?? [];
    list.push(r.bookId);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, bookIds]) => ({ key, bookIds }));
}

export async function getBatch(bookIds: string[]): Promise<Array<{
  id: string;
  fileName: string;
  bookType: schema.BookType;
  title: string | null;
  authors: string[];
}>> {
  if (bookIds.length === 0) return [];
  const db = requireDb();
  const rows = await db
    .select({
      id: schema.books.id,
      fileName: schema.books.fileName,
      bookType: schema.books.bookType,
      title: schema.bookMetadata.title,
    })
    .from(schema.books)
    .leftJoin(schema.bookMetadata, eq(schema.bookMetadata.bookId, schema.books.id))
    .where(inArray(schema.books.id, bookIds));
  // Fetch authors per book in one query.
  const authorRows = await db
    .select({
      bookId: schema.bookMetadataAuthorMapping.bookId,
      name: schema.authors.name,
    })
    .from(schema.bookMetadataAuthorMapping)
    .innerJoin(
      schema.authors,
      eq(schema.authors.id, schema.bookMetadataAuthorMapping.authorId),
    )
    .where(inArray(schema.bookMetadataAuthorMapping.bookId, bookIds));
  const authorsByBook = new Map<string, string[]>();
  for (const a of authorRows) {
    const list = authorsByBook.get(a.bookId) ?? [];
    list.push(a.name);
    authorsByBook.set(a.bookId, list);
  }
  return rows.map((r) => ({
    ...r,
    authors: authorsByBook.get(r.id) ?? [],
  }));
}
