import { eq } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { searchAll, getProvider, type MetadataMatch } from "./providers/index.ts";
import { updateBookMetadata } from "./metadata.ts";
import { saveCover } from "./covers.ts";
import { logger } from "../logger.ts";

/**
 * Apply a provider match to a book, respecting per-field locks. Anything the
 * user has locked (titleLocked, authorsLocked, …) keeps its current value.
 */
export async function applyMatch(
  bookId: string,
  match: MetadataMatch,
  opts: { applyCover?: boolean } = { applyCover: true },
): Promise<void> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(schema.bookMetadata)
    .where(eq(schema.bookMetadata.bookId, bookId))
    .limit(1);
  const current = rows[0];

  // Build a patch that omits locked fields.
  const patch: Record<string, unknown> = {};
  const allow = (key: string, currentLock: boolean | undefined) =>
    !currentLock;

  if (allow("title", current?.titleLocked) && match.title) patch.title = match.title;
  if (allow("subtitle", current?.subtitleLocked) && match.subtitle !== undefined)
    patch.subtitle = match.subtitle;
  if (allow("description", current?.descriptionLocked) && match.description !== undefined)
    patch.description = match.description;
  if (allow("publisher", current?.publisherLocked) && match.publisher !== undefined)
    patch.publisher = match.publisher;
  if (allow("publishedDate", current?.publishedDateLocked) && match.publishedDate !== undefined)
    patch.publishedDate = match.publishedDate;
  if (allow("isbn10", current?.isbnLocked) && match.isbn10 !== undefined)
    patch.isbn10 = match.isbn10;
  if (allow("isbn13", current?.isbnLocked) && match.isbn13 !== undefined)
    patch.isbn13 = match.isbn13;
  if (allow("pageCount", current?.pageCountLocked) && match.pageCount !== undefined)
    patch.pageCount = match.pageCount;
  if (allow("language", current?.languageLocked) && match.language !== undefined)
    patch.language = match.language;
  if (allow("authors", current?.authorsLocked) && match.authors?.length)
    patch.authors = match.authors;
  if (allow("categories", current?.categoriesLocked) && match.categories?.length)
    patch.categories = match.categories;

  await updateBookMetadata(bookId, patch);

  if (opts.applyCover && match.coverUrl && !current?.coverLocked) {
    try {
      const res = await fetch(match.coverUrl);
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer());
        const contentType = res.headers.get("Content-Type") ?? "image/jpeg";
        await saveCover(bookId, buf, contentType);
      }
    } catch (e) {
      logger.warn({ err: e, bookId, coverUrl: match.coverUrl }, "applyMatch: cover fetch failed");
    }
  }
}

/**
 * Look up a book's current title/isbn, ask every provider, and return the
 * candidates. Caller picks which to apply.
 */
export async function searchForBook(bookId: string, opts: { limit?: number } = {}) {
  const db = requireDb();
  const rows = await db
    .select({
      title: schema.bookMetadata.title,
      isbn13: schema.bookMetadata.isbn13,
      isbn10: schema.bookMetadata.isbn10,
    })
    .from(schema.bookMetadata)
    .where(eq(schema.bookMetadata.bookId, bookId))
    .limit(1);
  const meta = rows[0];
  if (!meta) return { matches: [], errors: [] };
  // Authors are in a join table — fetch lightly.
  const authorRows = await db
    .select({ name: schema.authors.name })
    .from(schema.bookMetadataAuthorMapping)
    .innerJoin(schema.authors, eq(schema.authors.id, schema.bookMetadataAuthorMapping.authorId))
    .where(eq(schema.bookMetadataAuthorMapping.bookId, bookId));
  return searchAll({
    title: meta.title ?? undefined,
    isbn: meta.isbn13 ?? meta.isbn10 ?? undefined,
    authors: authorRows.map((a) => a.name),
    limit: opts.limit ?? 10,
  });
}

/**
 * Auto-refresh: search providers and apply the top match. Used by the batch
 * refresh worker.
 */
export async function autoRefresh(bookId: string): Promise<{ applied: boolean; reason?: string }> {
  const { matches } = await searchForBook(bookId, { limit: 1 });
  const best = matches[0];
  if (!best) return { applied: false, reason: "No matches" };
  await applyMatch(bookId, best);
  return { applied: true };
}

/** Set a single per-field lock. */
export async function setLock(
  bookId: string,
  field:
    | "title"
    | "subtitle"
    | "description"
    | "publisher"
    | "publishedDate"
    | "isbn"
    | "pageCount"
    | "language"
    | "rating"
    | "ageRating"
    | "cover"
    | "authors"
    | "categories",
  locked: boolean,
): Promise<void> {
  const db = requireDb();
  const col: Record<typeof field, string> = {
    title: "titleLocked",
    subtitle: "subtitleLocked",
    description: "descriptionLocked",
    publisher: "publisherLocked",
    publishedDate: "publishedDateLocked",
    isbn: "isbnLocked",
    pageCount: "pageCountLocked",
    language: "languageLocked",
    rating: "ratingLocked",
    ageRating: "ageRatingLocked",
    cover: "coverLocked",
    authors: "authorsLocked",
    categories: "categoriesLocked",
  };
  const existing = await db
    .select({ bookId: schema.bookMetadata.bookId })
    .from(schema.bookMetadata)
    .where(eq(schema.bookMetadata.bookId, bookId))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(schema.bookMetadata).values({ bookId, [col[field]]: locked });
  } else {
    await db
      .update(schema.bookMetadata)
      .set({ [col[field]]: locked })
      .where(eq(schema.bookMetadata.bookId, bookId));
  }
}

// Re-export so callers can resolve a provider before fetching detail.
export { getProvider };
