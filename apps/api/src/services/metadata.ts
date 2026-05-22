import { and, eq, inArray } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";

export type MetadataUpdate = {
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  publisher?: string | null;
  publishedDate?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  asin?: string | null;
  pageCount?: number | null;
  language?: string | null;
  rating?: number | null;
  ageRating?: string | null;
  seriesName?: string | null;
  seriesNumber?: number | null;
  authors?: string[]; // free-text names; resolved to/from authors table
  categories?: string[];
  // Per-field lock booleans (subset).
  titleLocked?: boolean;
  descriptionLocked?: boolean;
  authorsLocked?: boolean;
};

async function upsertAuthors(names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const db = requireDb();
  const trimmed = names.map((n) => n.trim()).filter(Boolean);
  if (trimmed.length === 0) return [];
  const existing = await db
    .select({ id: schema.authors.id, name: schema.authors.name })
    .from(schema.authors)
    .where(inArray(schema.authors.name, trimmed));
  const byName = new Map(existing.map((a) => [a.name, a.id]));
  const missing = trimmed.filter((n) => !byName.has(n));
  if (missing.length) {
    const inserted = await db
      .insert(schema.authors)
      .values(missing.map((name) => ({ name })))
      .returning({ id: schema.authors.id, name: schema.authors.name });
    for (const a of inserted) byName.set(a.name, a.id);
  }
  return trimmed.map((n) => byName.get(n)!).filter((id): id is string => !!id);
}

async function upsertCategories(names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const db = requireDb();
  const trimmed = names.map((n) => n.trim()).filter(Boolean);
  if (trimmed.length === 0) return [];
  const existing = await db
    .select({ id: schema.categories.id, name: schema.categories.name })
    .from(schema.categories)
    .where(inArray(schema.categories.name, trimmed));
  const byName = new Map(existing.map((c) => [c.name, c.id]));
  const missing = trimmed.filter((n) => !byName.has(n));
  if (missing.length) {
    const inserted = await db
      .insert(schema.categories)
      .values(missing.map((name) => ({ name })))
      .returning({ id: schema.categories.id, name: schema.categories.name });
    for (const c of inserted) byName.set(c.name, c.id);
  }
  return trimmed.map((n) => byName.get(n)!).filter((id): id is string => !!id);
}

export async function updateBookMetadata(bookId: string, patch: MetadataUpdate): Promise<void> {
  const db = requireDb();
  const { authors, categories, ...scalar } = patch;

  // Upsert the row (book_metadata.bookId is the PK).
  const existing = await db
    .select()
    .from(schema.bookMetadata)
    .where(eq(schema.bookMetadata.bookId, bookId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.bookMetadata).values({ bookId, ...scalar });
  } else {
    if (Object.keys(scalar).length > 0) {
      await db
        .update(schema.bookMetadata)
        .set(scalar)
        .where(eq(schema.bookMetadata.bookId, bookId));
    }
  }

  if (authors) {
    const ids = await upsertAuthors(authors);
    await db
      .delete(schema.bookMetadataAuthorMapping)
      .where(eq(schema.bookMetadataAuthorMapping.bookId, bookId));
    if (ids.length)
      await db
        .insert(schema.bookMetadataAuthorMapping)
        .values(ids.map((authorId) => ({ bookId, authorId })));
  }
  if (categories) {
    const ids = await upsertCategories(categories);
    await db
      .delete(schema.bookMetadataCategoryMapping)
      .where(eq(schema.bookMetadataCategoryMapping.bookId, bookId));
    if (ids.length)
      await db
        .insert(schema.bookMetadataCategoryMapping)
        .values(ids.map((categoryId) => ({ bookId, categoryId })));
  }
}
