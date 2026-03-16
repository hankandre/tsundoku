import { db, schema } from "../db/client";
import { eq, ilike, and, sql, desc } from "drizzle-orm";
import { fail, assertIsDefined } from "../http/errors";

const ensureDb = () => {
  if (!db) {
    throw new Error("Database not configured");
  }
  return db;
};

export interface AuthorSummary {
  id: string;
  name: string;
  bookCount: number;
}

export interface AuthorDetails {
  id: string;
  name: string;
  description: string | null;
  asin: string | null;
  imageUrl: string | null;
  bookCount: number;
}

export const getAllAuthors = async (): Promise<AuthorSummary[]> => {
  const database = ensureDb();

  const authorsWithCount = await database
    .select({
      id: schema.authors.id,
      name: schema.authors.name,
      bookCount: sql<number>`count(${schema.bookMetadataAuthorMapping.authorId})`.mapWith(Number),
    })
    .from(schema.authors)
    .leftJoin(
      schema.bookMetadataAuthorMapping,
      eq(schema.authors.id, schema.bookMetadataAuthorMapping.authorId)
    )
    .groupBy(schema.authors.id)
    .orderBy(desc(sql<number>`count(${schema.bookMetadataAuthorMapping.authorId})`));

  return authorsWithCount.map((a) => ({
    id: a.id,
    name: a.name ?? "",
    bookCount: a.bookCount ?? 0,
  }));
};

export const getAuthorByName = async (name: string): Promise<AuthorDetails | null> => {
  const database = ensureDb();

  const result = await database
    .select()
    .from(schema.authors)
    .where(ilike(schema.authors.name, `%${name}%`))
    .limit(1);

  if (!result[0]) {
    return null;
  }

  const author = result[0];
  const bookCountResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(schema.bookMetadataAuthorMapping)
    .where(eq(schema.bookMetadataAuthorMapping.authorId, author.id));

  return {
    id: author.id,
    name: author.name ?? "",
    description: null,
    asin: null,
    imageUrl: null,
    bookCount: Number(bookCountResult[0]?.count ?? 0),
  };
};

export const getAuthorsByBookId = async (bookId: string): Promise<string[]> => {
  const database = ensureDb();

  const result = await database
    .select({
      name: schema.authors.name,
    })
    .from(schema.authors)
    .innerJoin(
      schema.bookMetadataAuthorMapping,
      and(
        eq(schema.authors.id, schema.bookMetadataAuthorMapping.authorId),
        eq(schema.bookMetadataAuthorMapping.bookId, bookId)
      )
    );

  return result.map((r) => r.name ?? "");
};

export const getAuthorById = async (authorId: string): Promise<AuthorDetails | null> => {
  const database = ensureDb();

  const result = await database
    .select()
    .from(schema.authors)
    .where(eq(schema.authors.id, authorId))
    .limit(1);

  if (!result[0]) {
    return null;
  }

  const author = result[0];
  const bookCountResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(schema.bookMetadataAuthorMapping)
    .where(eq(schema.bookMetadataAuthorMapping.authorId, author.id));

  return {
    id: author.id,
    name: author.name ?? "",
    description: null,
    asin: null,
    imageUrl: null,
    bookCount: Number(bookCountResult[0]?.count ?? 0),
  };
};

export interface UpdateAuthorInput {
  name?: string;
  description?: string;
  asin?: string;
}

export const updateAuthor = async (
  authorId: string,
  input: UpdateAuthorInput
): Promise<AuthorDetails> => {
  const database = ensureDb();

  const existing = await database
    .select()
    .from(schema.authors)
    .where(eq(schema.authors.id, authorId))
    .limit(1);

  if (!existing[0]) {
    fail(404, `Author not found: ${authorId}`);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updateData.name = input.name;

  await database
    .update(schema.authors)
    .set(updateData)
    .where(eq(schema.authors.id, authorId));

  return (await getAuthorById(authorId)) as AuthorDetails;
};

export const deleteAuthors = async (authorIds: string[]): Promise<void> => {
  const database = ensureDb();

  for (const authorId of authorIds) {
    await database
      .delete(schema.bookMetadataAuthorMapping)
      .where(eq(schema.bookMetadataAuthorMapping.authorId, authorId));

    await database
      .delete(schema.authors)
      .where(eq(schema.authors.id, authorId));
  }
};

export const searchAuthorMetadata = async (
  _authorId: string,
  _query: string
): Promise<Array<{ name: string; asin: string; description: string }>> => {
  fail(501, "Author metadata search requires external provider integration");
  return [];
};

export const quickMatchAuthor = async (_authorId: string): Promise<AuthorDetails> => {
  fail(501, "Author quick-match requires external provider integration");
  return { id: "", name: "", description: null, asin: null, imageUrl: null, bookCount: 0 };
};
