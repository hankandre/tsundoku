import { sql, eq, asc, inArray, and } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";

export type AuthorSummary = {
  id: string;
  name: string;
  bookCount: number;
};

export async function listAuthors(): Promise<AuthorSummary[]> {
  const db = requireDb();
  const rows = await db
    .select({
      id: schema.authors.id,
      name: schema.authors.name,
      count: sql<number>`count(${schema.bookMetadataAuthorMapping.bookId})::int`,
    })
    .from(schema.authors)
    .leftJoin(
      schema.bookMetadataAuthorMapping,
      eq(schema.bookMetadataAuthorMapping.authorId, schema.authors.id),
    )
    .groupBy(schema.authors.id, schema.authors.name)
    .orderBy(asc(schema.authors.name));
  return rows.map((r) => ({ id: r.id, name: r.name, bookCount: r.count }));
}

export async function getAuthor(id: string): Promise<{
  id: string;
  name: string;
  bio: string | null;
  imageUrl: string | null;
  bookIds: string[];
} | null> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(schema.authors)
    .where(eq(schema.authors.id, id))
    .limit(1);
  const a = rows[0];
  if (!a) return null;
  const mapped = await db
    .select({ bookId: schema.bookMetadataAuthorMapping.bookId })
    .from(schema.bookMetadataAuthorMapping)
    .where(eq(schema.bookMetadataAuthorMapping.authorId, id));
  return {
    id: a.id,
    name: a.name,
    bio: a.bio,
    imageUrl: a.imageUrl,
    bookIds: mapped.map((m) => m.bookId),
  };
}

export async function updateAuthor(
  id: string,
  patch: { name?: string; bio?: string | null; imageUrl?: string | null },
): Promise<void> {
  const db = requireDb();
  await db.update(schema.authors).set(patch).where(eq(schema.authors.id, id));
}

/**
 * Merge two authors. All book mappings under `sourceId` are reattributed to
 * `targetId`; the source row is then deleted. Wrapped in a transaction so a
 * partial failure can't leave dangling references.
 */
export async function mergeAuthors(sourceId: string, targetId: string): Promise<void> {
  if (sourceId === targetId) return;
  const db = requireDb();
  await db.transaction(async (tx) => {
    // Reattribute mappings, ignoring any that would create a duplicate
    // (book already mapped to target). Postgres' ON CONFLICT DO NOTHING
    // expresses that idiomatically.
    await tx.execute(sql`
      INSERT INTO book_metadata_author_mapping (book_id, author_id)
      SELECT book_id, ${targetId}::uuid FROM book_metadata_author_mapping
      WHERE author_id = ${sourceId}::uuid
      ON CONFLICT DO NOTHING
    `);
    await tx
      .delete(schema.bookMetadataAuthorMapping)
      .where(eq(schema.bookMetadataAuthorMapping.authorId, sourceId));
    await tx.delete(schema.authors).where(eq(schema.authors.id, sourceId));
  });
}

export async function getBooksByAuthor(authorId: string, allowed: string[] | "all") {
  const db = requireDb();
  const mapping = await db
    .select({ bookId: schema.bookMetadataAuthorMapping.bookId })
    .from(schema.bookMetadataAuthorMapping)
    .where(eq(schema.bookMetadataAuthorMapping.authorId, authorId));
  const bookIds = mapping.map((m) => m.bookId);
  if (bookIds.length === 0) return [];
  if (allowed !== "all" && allowed.length === 0) return [];

  const bookFilter = inArray(schema.books.id, bookIds);
  const whereClause =
    allowed === "all"
      ? bookFilter
      : and(bookFilter, inArray(schema.books.libraryId, allowed));
  const rows = await db
    .select({
      id: schema.books.id,
      fileName: schema.books.fileName,
      bookType: schema.books.bookType,
      title: schema.bookMetadata.title,
    })
    .from(schema.books)
    .leftJoin(schema.bookMetadata, eq(schema.bookMetadata.bookId, schema.books.id))
    .where(whereClause);
  return rows;
}
