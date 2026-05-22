import { inArray } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../src/db.ts";
import { createLocalUser } from "../src/services/users.ts";
import { issueTokens } from "../src/services/tokens.ts";
import { app } from "../src/app.ts";

// Every test row inserted by this suite is tagged with this prefix so a
// crashed run is easy to clean up: `DELETE FROM users WHERE username LIKE
// 'vitest_%'` and the FK cascades take care of the rest.
export const TEST_PREFIX = "buntest_";

export type TestUser = {
  id: string;
  username: string;
  bearer: string;
};

export async function createTestUser(opts?: {
  isAdmin?: boolean;
}): Promise<TestUser> {
  const username = TEST_PREFIX + crypto.randomUUID().slice(0, 8);
  const user = await createLocalUser({
    username,
    password: "test-password-12345",
    // Default to a regular user so library scoping is exercised. Tests that
    // need admin behavior should pass { isAdmin: true } explicitly.
    isAdmin: opts?.isAdmin ?? false,
  });
  const { accessToken } = await issueTokens({
    userId: user.id,
    username: user.username,
    isAdmin: user.permissions.admin,
    permissions: [],
  });
  return { id: user.id, username: user.username, bearer: accessToken };
}

export async function deleteTestUsers(usernames: string[]) {
  if (!usernames.length) return;
  const db = requireDb();
  await db
    .delete(schema.users)
    .where(inArray(schema.users.username, usernames));
}

export type SeededBook = {
  id: string;
  title: string;
  rating: number | null;
  pageCount: number | null;
  bookType: schema.BookType;
};

export type SeedResult = {
  libraryId: string;
  libraryPathId: string;
  books: SeededBook[];
  authorIds: string[];
  authorNames: string[];
};

/**
 * Inserts a self-contained library, four books with metadata, and two authors
 * linked to a subset of the books. The user is granted access to the library.
 * Returns the resulting IDs so tests can build rule predicates against known
 * data and assert exact counts.
 */
export async function seedLibraryAndBooks(userId: string): Promise<SeedResult> {
  const db = requireDb();
  const libRows = await db
    .insert(schema.libraries)
    .values({ name: TEST_PREFIX + "lib-" + crypto.randomUUID().slice(0, 6) })
    .returning();
  const libraryId = libRows[0]!.id;

  await db.insert(schema.userLibraryMapping).values({ userId, libraryId });

  const pathRows = await db
    .insert(schema.libraryPaths)
    .values({ libraryId, path: "/tmp/" + libraryId })
    .returning();
  const libraryPathId = pathRows[0]!.id;

  const bookSpecs: Array<{
    title: string;
    bookType: schema.BookType;
    rating: number;
    pageCount: number;
  }> = [
    { title: "Alpha High Rated", bookType: "EPUB", rating: 5, pageCount: 200 },
    { title: "Beta Mid Rated", bookType: "EPUB", rating: 4, pageCount: 300 },
    { title: "Gamma Low Rated", bookType: "PDF", rating: 2, pageCount: 100 },
    { title: "Delta No Rating", bookType: "PDF", rating: 0, pageCount: 500 },
  ];

  const bookRows = await db
    .insert(schema.books)
    .values(
      bookSpecs.map((b, i) => ({
        libraryId,
        libraryPathId,
        fileName: `book-${i}.${b.bookType.toLowerCase()}`,
        bookType: b.bookType,
      })),
    )
    .returning();

  await db.insert(schema.bookMetadata).values(
    bookRows.map((row, i) => ({
      bookId: row.id,
      title: bookSpecs[i]!.title,
      rating: bookSpecs[i]!.rating || null,
      pageCount: bookSpecs[i]!.pageCount,
    })),
  );

  const authorRows = await db
    .insert(schema.authors)
    .values([
      { name: TEST_PREFIX + "Alice " + crypto.randomUUID().slice(0, 4) },
      { name: TEST_PREFIX + "Bob " + crypto.randomUUID().slice(0, 4) },
    ])
    .returning();

  // Alice → Alpha + Beta; Bob → Beta + Gamma. Used by includes_any /
  // excludes_all / includes_all collection-operator tests.
  await db.insert(schema.bookMetadataAuthorMapping).values([
    { bookId: bookRows[0]!.id, authorId: authorRows[0]!.id },
    { bookId: bookRows[1]!.id, authorId: authorRows[0]!.id },
    { bookId: bookRows[1]!.id, authorId: authorRows[1]!.id },
    { bookId: bookRows[2]!.id, authorId: authorRows[1]!.id },
  ]);

  return {
    libraryId,
    libraryPathId,
    books: bookRows.map((r, i) => ({
      id: r.id,
      title: bookSpecs[i]!.title,
      rating: bookSpecs[i]!.rating || null,
      pageCount: bookSpecs[i]!.pageCount,
      bookType: bookSpecs[i]!.bookType,
    })),
    authorIds: authorRows.map((a) => a.id),
    authorNames: authorRows.map((a) => a.name),
  };
}

export async function deleteLibraries(libraryIds: string[]) {
  if (!libraryIds.length) return;
  const db = requireDb();
  await db
    .delete(schema.libraries)
    .where(inArray(schema.libraries.id, libraryIds));
}

export async function deleteAuthors(authorIds: string[]) {
  if (!authorIds.length) return;
  const db = requireDb();
  await db.delete(schema.authors).where(inArray(schema.authors.id, authorIds));
}

/** Thin wrapper for `app.request` that injects the bearer header. */
export async function authedRequest(
  bearer: string,
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${bearer}`);
  let body = init?.body;
  if (init?.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  return app.request(path, { ...init, headers, body });
}
