import { and, eq, inArray, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import {
  userMaxRatingOrdinal,
  contentRestrictionFilter,
} from "./content-restriction.ts";
import { compileMagicShelfWhere, type MagicShelfRulesInput } from "./magic-shelf-rules.ts";

const SORT_COLUMNS = {
  addedOn: schema.books.addedOn,
  title: schema.bookMetadata.title,
  rating: schema.bookMetadata.rating,
  pageCount: schema.bookMetadata.pageCount,
} as const satisfies Record<NonNullable<BookQuery["sort"]>, AnyColumn>;

// Postgres defaults to NULLS FIRST on DESC and NULLS LAST on ASC. For sortable
// columns like `rating` / `pageCount` that's the opposite of what users want
// ("top rated" should not be dominated by books with no rating), so we pin
// NULLS LAST in both directions.
function buildOrderBy(sort: BookQuery["sort"], direction: BookQuery["direction"]): SQL {
  const column = SORT_COLUMNS[sort ?? "addedOn"];
  const dir = direction === "asc" ? sql.raw("asc") : sql.raw("desc");
  return sql`${column} ${dir} nulls last`;
}

export type BookListItem = {
  id: string;
  libraryId: string;
  libraryPathId: string;
  fileName: string;
  fileSubPath: string | null;
  bookType: schema.BookType;
  addedOn: Date;
  scannedOn: Date | null;
  title: string | null;
  authors: string[];
  pageCount: number | null;
  rating: number | null;
};

export type BookQuery = {
  libraryId?: string;
  shelfId?: string;
  magicShelfId?: string;
  // Transient rule tree used by the magic-shelves preview endpoint: compiles
  // straight to a predicate without an ownership lookup. The caller controls
  // auth; the rules are user-supplied and arktype-validated upstream.
  magicShelfRules?: MagicShelfRulesInput;
  search?: string;
  bookType?: schema.BookType;
  sort?: "addedOn" | "title" | "rating" | "pageCount";
  direction?: "asc" | "desc";
  page?: number;
  size?: number;
};

type BookPage = {
  content: BookListItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

async function allowedLibraryIds(userId: string, isAdmin: boolean): Promise<string[] | "all"> {
  if (isAdmin) return "all";
  const db = requireDb();
  const rows = await db
    .select({ libraryId: schema.userLibraryMapping.libraryId })
    .from(schema.userLibraryMapping)
    .where(eq(schema.userLibraryMapping.userId, userId));
  return rows.map((r) => r.libraryId);
}

function emptyBookPage(page: number, size: number): BookPage {
  return { content: [], page, size, totalElements: 0, totalPages: 0 };
}

async function ownedMagicShelfRules(
  magicShelfId: string,
  userId: string,
): Promise<MagicShelfRulesInput | null> {
  const db = requireDb();
  const shelfRows = await db
    .select({
      rules: schema.magicShelves.rules,
      userId: schema.magicShelves.userId,
    })
    .from(schema.magicShelves)
    .where(eq(schema.magicShelves.id, magicShelfId))
    .limit(1);

  const shelf = shelfRows[0];
  if (!shelf || shelf.userId !== userId) return null;
  return shelf.rules as MagicShelfRulesInput;
}

async function authorsForBooks(bookIds: string[]): Promise<Map<string, string[]>> {
  const authorsByBook = new Map<string, string[]>();
  if (!bookIds.length) return authorsByBook;

  const db = requireDb();
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

  for (const author of authorRows) {
    const list = authorsByBook.get(author.bookId) ?? [];
    list.push(author.name);
    authorsByBook.set(author.bookId, list);
  }

  return authorsByBook;
}

export async function listBooks(
  userId: string,
  isAdmin: boolean,
  q: BookQuery,
): Promise<BookPage> {
  const db = requireDb();
  const page = Math.max(0, q.page ?? 0);
  const size = Math.min(100, Math.max(1, q.size ?? 25));

  const allowed = await allowedLibraryIds(userId, isAdmin);
  if (allowed !== "all" && allowed.length === 0) {
    return emptyBookPage(page, size);
  }

  const conds: SQL[] = [];
  if (allowed !== "all") conds.push(inArray(schema.books.libraryId, allowed));
  if (q.libraryId != null) conds.push(eq(schema.books.libraryId, q.libraryId));
  if (q.bookType) conds.push(eq(schema.books.bookType, q.bookType));
  // Apply per-user age-rating filter (no-op if the user has no restriction).
  const maxOrdinal = await userMaxRatingOrdinal(userId);
  const restriction = contentRestrictionFilter(maxOrdinal);
  if (restriction) conds.push(restriction);
  if (q.search) {
    // websearch_to_tsquery accepts user-style queries: quoted phrases, OR,
    // and unary "not" — no need to escape or pre-parse. The generated
    // search_vector column has a GIN index for this match.
    conds.push(
      sql`${schema.bookMetadata.bookId} IN (
        SELECT book_id FROM book_metadata
        WHERE search_vector @@ websearch_to_tsquery('simple', ${q.search})
      )`,
    );
  }
  if (q.shelfId != null) {
    conds.push(
      sql`exists (select 1 from ${schema.bookShelfMapping}
        where ${schema.bookShelfMapping.bookId} = ${schema.books.id}
        and ${schema.bookShelfMapping.shelfId} = ${q.shelfId})`,
    );
  }
  if (q.magicShelfId != null) {
    // Magic shelves require ownership: load the rules iff the requester owns
    // the shelf, then AND the compiled predicate into the books filter.
    // Returning early on a not-owned shelf prevents leaking content the user
    // wouldn't otherwise see via library scoping.
    const rules = await ownedMagicShelfRules(q.magicShelfId, userId);
    if (!rules) return emptyBookPage(page, size);
    conds.push(compileMagicShelfWhere(rules));
  }
  if (q.magicShelfRules != null) {
    conds.push(compileMagicShelfWhere(q.magicShelfRules));
  }
  const whereExpr = conds.length === 0 ? undefined : and(...conds);

  const orderExpr = buildOrderBy(q.sort, q.direction);

  const baseSelect = db
    .select({
      id: schema.books.id,
      libraryId: schema.books.libraryId,
      libraryPathId: schema.books.libraryPathId,
      fileName: schema.books.fileName,
      fileSubPath: schema.books.fileSubPath,
      bookType: schema.books.bookType,
      addedOn: schema.books.addedOn,
      scannedOn: schema.books.scannedOn,
      title: schema.bookMetadata.title,
      pageCount: schema.bookMetadata.pageCount,
      rating: schema.bookMetadata.rating,
    })
    .from(schema.books)
    .leftJoin(schema.bookMetadata, eq(schema.bookMetadata.bookId, schema.books.id));

  const rows = whereExpr
    ? await baseSelect.where(whereExpr).orderBy(orderExpr).limit(size).offset(page * size)
    : await baseSelect.orderBy(orderExpr).limit(size).offset(page * size);

  const countQ = db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.books)
    .leftJoin(schema.bookMetadata, eq(schema.bookMetadata.bookId, schema.books.id));
  const countRows = whereExpr ? await countQ.where(whereExpr) : await countQ;
  const total = countRows[0]?.count ?? 0;

  // Fetch authors per book in a single query.
  const ids = rows.map((r) => r.id);
  const authorsByBook = await authorsForBooks(ids);

  return {
    content: rows.map((r) => ({
      ...r,
      authors: authorsByBook.get(r.id) ?? [],
    })),
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
  };
}

export async function getBookDetail(
  userId: string,
  isAdmin: boolean,
  bookId: string,
): Promise<(BookListItem & { metadata: Record<string, unknown> | null }) | null> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(schema.books)
    .leftJoin(schema.bookMetadata, eq(schema.bookMetadata.bookId, schema.books.id))
    .where(eq(schema.books.id, bookId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  if (!isAdmin) {
    const allowed = await allowedLibraryIds(userId, false);
    if (allowed === "all") {
      // unreachable: isAdmin=false means allowed is array
    } else if (!allowed.includes(row.books.libraryId)) {
      return null;
    }
  }

  // Content-restriction check applies to non-admins (and even to admins if
  // they've set their own restriction — opt-in for parental UX).
  const maxOrdinal = await userMaxRatingOrdinal(userId);
  if (maxOrdinal != null) {
    const ageRating = row.book_metadata?.ageRating;
    const { ordinalFor } = await import("./content-restriction.ts");
    if (ordinalFor(ageRating) > maxOrdinal) return null;
  }

  const authorRows = await db
    .select({ name: schema.authors.name })
    .from(schema.bookMetadataAuthorMapping)
    .innerJoin(schema.authors, eq(schema.authors.id, schema.bookMetadataAuthorMapping.authorId))
    .where(eq(schema.bookMetadataAuthorMapping.bookId, bookId));

  return {
    id: row.books.id,
    libraryId: row.books.libraryId,
    libraryPathId: row.books.libraryPathId,
    fileName: row.books.fileName,
    fileSubPath: row.books.fileSubPath,
    bookType: row.books.bookType,
    addedOn: row.books.addedOn,
    scannedOn: row.books.scannedOn,
    title: row.book_metadata?.title ?? null,
    pageCount: row.book_metadata?.pageCount ?? null,
    rating: row.book_metadata?.rating ?? null,
    authors: authorRows.map((a) => a.name),
    metadata: row.book_metadata
      ? (row.book_metadata as unknown as Record<string, unknown>)
      : null,
  };
}
