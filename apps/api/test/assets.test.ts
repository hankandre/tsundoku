import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import {
  TEST_PREFIX,
  authedRequest,
  createTestUser,
  deleteAuthors,
  deleteLibraries,
  deleteTestUsers,
  seedLibraryAndBooks,
  type SeedResult,
  type TestUser,
} from "./helpers.ts";
import { app } from "../src/app.ts";
import { requireDb } from "../src/db.ts";
import { saveCover, deleteCover } from "../src/services/covers.ts";

// Track DB IDs we create directly so afterAll can clean them up. Anything we
// insert is tagged with TEST_PREFIX in any visible name column.
const createdIconIds: string[] = [];
const createdFontIds: string[] = [];
const createdSeriesBookIds: string[] = [];
const createdSeriesLibraryIds: string[] = [];
const coversToCleanup: string[] = [];
const adminAuthorsToDelete: string[] = [];

let primary: TestUser;
let secondary: TestUser;
let admin: TestUser;
let seeded: SeedResult;

beforeAll(async () => {
  primary = await createTestUser();
  secondary = await createTestUser();
  admin = await createTestUser({ isAdmin: true });
  seeded = await seedLibraryAndBooks(primary.id);
});

afterAll(async () => {
  const db = requireDb();
  // Best-effort cleanup of any covers we wrote to disk.
  for (const bookId of coversToCleanup) {
    await deleteCover(bookId).catch(() => {});
  }
  if (createdIconIds.length) {
    await db.delete(schema.customIcons).where(inArray(schema.customIcons.id, createdIconIds));
  }
  if (createdFontIds.length) {
    await db.delete(schema.customFonts).where(inArray(schema.customFonts.id, createdFontIds));
  }
  // Series-specific seeded libraries cascade their books on delete.
  await deleteLibraries([...createdSeriesLibraryIds, seeded.libraryId]);
  await deleteAuthors([...seeded.authorIds, ...adminAuthorsToDelete]);
  await deleteTestUsers([primary.username, secondary.username, admin.username]);
});

// --------------------------------------------------------------------------
// covers.ts
// --------------------------------------------------------------------------
describe("covers — admin endpoints", () => {
  // Tiny valid PNG (1x1 transparent) — enough to satisfy image/* validation.
  const pngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  test("PUT /books/:id/cover auth + permission gates (401 / 403 / 400 / 415)", async () => {
    const bookId = seeded.books[0]!.id;
    // 401 without bearer.
    const noauth = await app.request(`/api/v1/books/${bookId}/cover`, { method: "PUT" });
    expect(noauth.status).toBe(401);

    // 403 for a normal user (no editMetadata).
    const noperm = new FormData();
    noperm.set("file", new File([pngBytes], "c.png", { type: "image/png" }));
    const denied = await authedRequest(primary.bearer, `/api/v1/books/${bookId}/cover`, {
      method: "PUT",
      body: noperm,
    });
    expect(denied.status).toBe(403);

    // 400 when admin posts no file.
    const noFile = await authedRequest(admin.bearer, `/api/v1/books/${bookId}/cover`, {
      method: "PUT",
      body: new FormData(),
    });
    expect(noFile.status).toBe(400);

    // 415 for non-image.
    const bad = new FormData();
    bad.set("file", new File([new Uint8Array([1, 2, 3])], "x.txt", { type: "text/plain" }));
    const wrong = await authedRequest(admin.bearer, `/api/v1/books/${bookId}/cover`, {
      method: "PUT",
      body: bad,
    });
    expect(wrong.status).toBe(415);
  });

  test("PUT /books/:id/cover writes cover; GET /books/:id/cover streams it", async () => {
    const bookId = seeded.books[0]!.id;
    coversToCleanup.push(bookId);
    const form = new FormData();
    form.set("file", new File([pngBytes], "c.png", { type: "image/png" }));
    const put = await authedRequest(admin.bearer, `/api/v1/books/${bookId}/cover`, {
      method: "PUT",
      body: form,
    });
    expect(put.status).toBe(200);
    expect((await put.json()).ok).toBe(true);

    const get = await authedRequest(primary.bearer, `/api/v1/books/${bookId}/cover`);
    expect(get.status).toBe(200);
    expect(get.headers.get("content-type") ?? "").toMatch(/^image\//);
  });

  test("GET /books/:id/cover for a book without a cover returns 404", async () => {
    // Use a book we haven't written a cover for and clean any stale file first.
    const bookId = seeded.books[3]!.id;
    await deleteCover(bookId).catch(() => {});
    const res = await authedRequest(primary.bearer, `/api/v1/books/${bookId}/cover`);
    expect(res.status).toBe(404);
  });

  test("GET /books/:id/cover supports ?token= query auth", async () => {
    // Seed a cover so we get a 200 rather than 404.
    const bookId = seeded.books[1]!.id;
    coversToCleanup.push(bookId);
    await saveCover(bookId, pngBytes, "image/png");
    const res = await app.request(
      `/api/v1/books/${bookId}/cover?token=${encodeURIComponent(primary.bearer)}`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toMatch(/^image\//);
  });

  test("POST /books/:id/cover/lock + /unlock toggle the coverLocked flag", async () => {
    const bookId = seeded.books[0]!.id;
    const lock = await authedRequest(admin.bearer, `/api/v1/books/${bookId}/cover/lock`, {
      method: "POST",
    });
    expect(lock.status).toBe(200);
    const db = requireDb();
    const locked = await db
      .select({ coverLocked: schema.bookMetadata.coverLocked })
      .from(schema.bookMetadata)
      .where(eq(schema.bookMetadata.bookId, bookId))
      .limit(1);
    expect(locked[0]!.coverLocked).toBe(true);

    const unlock = await authedRequest(admin.bearer, `/api/v1/books/${bookId}/cover/unlock`, {
      method: "POST",
    });
    expect(unlock.status).toBe(200);
    const after = await db
      .select({ coverLocked: schema.bookMetadata.coverLocked })
      .from(schema.bookMetadata)
      .where(eq(schema.bookMetadata.bookId, bookId))
      .limit(1);
    expect(after[0]!.coverLocked).toBe(false);
  });

  test("POST /books/:id/cover/lock is 403 for non-admin without editMetadata", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(primary.bearer, `/api/v1/books/${bookId}/cover/lock`, {
      method: "POST",
    });
    expect(res.status).toBe(403);
  });

  test("DELETE /books/:id/cover removes it; next GET is 404", async () => {
    const bookId = seeded.books[2]!.id;
    coversToCleanup.push(bookId);
    await saveCover(bookId, pngBytes, "image/png");
    const del = await authedRequest(admin.bearer, `/api/v1/books/${bookId}/cover`, {
      method: "DELETE",
    });
    expect(del.status).toBe(200);
    const get = await authedRequest(primary.bearer, `/api/v1/books/${bookId}/cover`);
    expect(get.status).toBe(404);
  });

  test("POST /books/:id/cover/from-url validates URL shape (400)", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(admin.bearer, `/api/v1/books/${bookId}/cover/from-url`, {
      method: "POST",
      json: { url: "not-a-url" },
    });
    expect(res.status).toBe(400);
  });

  test("POST /books/:id/cover/regenerate returns 404 when the file isn't on disk", async () => {
    // Seeded books have no real file at libraryPath; resolveBookFile should
    // return null → 404. (If the handler 500'd, that'd be a real bug — surfacing
    // it here is the point of this test.)
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(admin.bearer, `/api/v1/books/${bookId}/cover/regenerate`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  test("GET /books/:id/cover/search returns an array (providers may be empty)", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(primary.bearer, `/api/v1/books/${bookId}/cover/search`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("GET /books/:id/cover/search 404s when the book has no metadata row", async () => {
    // Random UUID — no metadata row exists.
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/books/${crypto.randomUUID()}/cover/search`,
    );
    expect(res.status).toBe(404);
  });

});

// --------------------------------------------------------------------------
// icons.ts
// --------------------------------------------------------------------------
describe("icons", () => {
  test("GET /icons requires auth", async () => {
    const res = await app.request("/api/v1/icons");
    expect(res.status).toBe(401);
  });

  test("GET /icons returns an array for any authed user", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/icons");
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test("POST /icons gates: admin-only (403), unsupported ext (415), missing file/name (400)", async () => {
    // 403 for non-admin.
    const ok = new FormData();
    ok.set("name", TEST_PREFIX + "denied");
    ok.set("file", new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }));
    const denied = await authedRequest(primary.bearer, "/api/v1/icons", {
      method: "POST",
      body: ok,
    });
    expect(denied.status).toBe(403);

    // 415 for an unsupported ext.
    const badExt = new FormData();
    badExt.set("name", TEST_PREFIX + "ico-" + crypto.randomUUID().slice(0, 4));
    badExt.set("file", new File(["x"], "x.gif", { type: "image/gif" }));
    const wrongExt = await authedRequest(admin.bearer, "/api/v1/icons", {
      method: "POST",
      body: badExt,
    });
    expect(wrongExt.status).toBe(415);

    // 400 missing file.
    const noFile = new FormData();
    noFile.set("name", TEST_PREFIX + "no-file");
    const r1 = await authedRequest(admin.bearer, "/api/v1/icons", {
      method: "POST",
      body: noFile,
    });
    expect(r1.status).toBe(400);

    // 400 missing name.
    const noName = new FormData();
    noName.set("file", new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }));
    const r2 = await authedRequest(admin.bearer, "/api/v1/icons", {
      method: "POST",
      body: noName,
    });
    expect(r2.status).toBe(400);
  });

  test("POST /icons happy path -> 201 + appears in list + file streams back", async () => {
    const name = TEST_PREFIX + "icon-" + crypto.randomUUID().slice(0, 6);
    const form = new FormData();
    form.set("name", name);
    form.set(
      "file",
      new File(["<svg xmlns='http://www.w3.org/2000/svg'/>"], "x.svg", {
        type: "image/svg+xml",
      }),
    );
    const create = await authedRequest(admin.bearer, "/api/v1/icons", {
      method: "POST",
      body: form,
    });
    expect(create.status).toBe(201);
    const created = await create.json();
    expect(created.id).toBeTruthy();
    expect(created.name).toBe(name);
    expect(created.mimeType).toBe("image/svg+xml");
    createdIconIds.push(created.id);

    const list = await authedRequest(primary.bearer, "/api/v1/icons").then((r) => r.json());
    expect(list.some((i: { id: string }) => i.id === created.id)).toBe(true);

    const file = await authedRequest(primary.bearer, `/api/v1/icons/${created.id}/file`);
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type") ?? "").toContain("svg");
  });

  test("GET /icons/:id/file 404s for unknown id", async () => {
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/icons/${crypto.randomUUID()}/file`,
    );
    expect(res.status).toBe(404);
  });

  test("DELETE /icons/:id: 403 for non-admin, 404 for unknown id as admin", async () => {
    const userRes = await authedRequest(primary.bearer, `/api/v1/icons/${crypto.randomUUID()}`, {
      method: "DELETE",
    });
    expect(userRes.status).toBe(403);
    const adminRes = await authedRequest(admin.bearer, `/api/v1/icons/${crypto.randomUUID()}`, {
      method: "DELETE",
    });
    expect(adminRes.status).toBe(404);
  });
});

// --------------------------------------------------------------------------
// fonts.ts
// --------------------------------------------------------------------------
describe("fonts", () => {
  test("GET /fonts requires auth", async () => {
    const res = await app.request("/api/v1/fonts");
    expect(res.status).toBe(401);
  });

  test("GET /fonts returns an array for any authed user", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/fonts");
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test("POST /fonts gates: 403 for non-admin, 415 for unsupported ext", async () => {
    const ok = new FormData();
    ok.set("name", TEST_PREFIX + "font");
    ok.set("file", new File([new Uint8Array([0])], "f.woff2", { type: "font/woff2" }));
    const denied = await authedRequest(primary.bearer, "/api/v1/fonts", {
      method: "POST",
      body: ok,
    });
    expect(denied.status).toBe(403);

    const bad = new FormData();
    bad.set("name", TEST_PREFIX + "font-" + crypto.randomUUID().slice(0, 4));
    bad.set("file", new File([new Uint8Array([0])], "x.eot", { type: "application/octet-stream" }));
    const wrong = await authedRequest(admin.bearer, "/api/v1/fonts", {
      method: "POST",
      body: bad,
    });
    expect(wrong.status).toBe(415);
  });

  test("POST /fonts happy path -> 201 + appears in list + file streams back", async () => {
    const name = TEST_PREFIX + "font-" + crypto.randomUUID().slice(0, 6);
    const form = new FormData();
    form.set("name", name);
    form.set(
      "file",
      new File([new Uint8Array([0, 1, 2, 3])], "f.woff2", { type: "font/woff2" }),
    );
    const create = await authedRequest(admin.bearer, "/api/v1/fonts", {
      method: "POST",
      body: form,
    });
    expect(create.status).toBe(201);
    const created = await create.json();
    expect(created.id).toBeTruthy();
    expect(created.name).toBe(name);
    expect(created.mimeType).toBe("font/woff2");
    createdFontIds.push(created.id);

    const list = await authedRequest(primary.bearer, "/api/v1/fonts").then((r) => r.json());
    expect(list.some((f: { id: string }) => f.id === created.id)).toBe(true);

    const file = await authedRequest(primary.bearer, `/api/v1/fonts/${created.id}/file`);
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type") ?? "").toContain("font");
  });

  test("GET /fonts/:id/file 404s for unknown id", async () => {
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/fonts/${crypto.randomUUID()}/file`,
    );
    expect(res.status).toBe(404);
  });

  test("DELETE /fonts/:id requires admin (403 for normal user)", async () => {
    const res = await authedRequest(primary.bearer, `/api/v1/fonts/${crypto.randomUUID()}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(403);
  });
});

// --------------------------------------------------------------------------
// authors.ts
// --------------------------------------------------------------------------
describe("authors", () => {
  test("GET /authors requires auth", async () => {
    const res = await app.request("/api/v1/authors");
    expect(res.status).toBe(401);
  });

  test("GET /authors lists seeded authors with bookCount", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/authors");
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    const alice = list.find((a: { id: string }) => a.id === seeded.authorIds[0]);
    const bob = list.find((a: { id: string }) => a.id === seeded.authorIds[1]);
    expect(alice).toBeTruthy();
    expect(bob).toBeTruthy();
    // Alice → Alpha + Beta (2), Bob → Beta + Gamma (2). See helpers.ts.
    expect(alice.bookCount).toBe(2);
    expect(bob.bookCount).toBe(2);
  });

  test("GET /authors/:id returns the author with books scoped to the user's libraries", async () => {
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/authors/${seeded.authorIds[0]}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(seeded.authorIds[0]);
    expect(body.name).toBe(seeded.authorNames[0]);
    expect(Array.isArray(body.books)).toBe(true);
    expect(body.books.length).toBe(2);
  });

  test("GET /authors/:id scopes books to allowed libraries — secondary user sees no books", async () => {
    // secondary has no userLibraryMapping → allowedLibraries returns [].
    const res = await authedRequest(
      secondary.bearer,
      `/api/v1/authors/${seeded.authorIds[0]}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.books).toEqual([]);
  });

  test("GET /authors/:id input validation: 404 for unknown UUID, 400 for non-UUID", async () => {
    const missing = await authedRequest(
      primary.bearer,
      `/api/v1/authors/${crypto.randomUUID()}`,
    );
    expect(missing.status).toBe(404);
    const bad = await authedRequest(primary.bearer, `/api/v1/authors/not-a-uuid`);
    expect(bad.status).toBe(400);
  });

  test("PATCH /authors/:id forbids users without editMetadata (403)", async () => {
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/authors/${seeded.authorIds[0]}`,
      { method: "PATCH", json: { bio: "nope" } },
    );
    expect(res.status).toBe(403);
  });

  test("PATCH /authors/:id as admin updates the bio", async () => {
    const newBio = TEST_PREFIX + "bio " + crypto.randomUUID().slice(0, 6);
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/authors/${seeded.authorIds[0]}`,
      { method: "PATCH", json: { bio: newBio } },
    );
    expect(res.status).toBe(200);
    const after = await authedRequest(
      admin.bearer,
      `/api/v1/authors/${seeded.authorIds[0]}`,
    ).then((r) => r.json());
    expect(after.bio).toBe(newBio);
  });

  test("GET /authors/:id/photo 404s when no photo file exists", async () => {
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/authors/${seeded.authorIds[1]}/photo`,
    );
    expect(res.status).toBe(404);
  });

  test("POST /authors/merge merges source into target and removes the source", async () => {
    // Create a fresh source + target pair so we don't blow up other tests.
    const db = requireDb();
    const inserted = await db
      .insert(schema.authors)
      .values([
        { name: TEST_PREFIX + "merge-src-" + crypto.randomUUID().slice(0, 4) },
        { name: TEST_PREFIX + "merge-tgt-" + crypto.randomUUID().slice(0, 4) },
      ])
      .returning();
    const sourceId = inserted[0]!.id;
    const targetId = inserted[1]!.id;
    // Track for cleanup — target survives, source is deleted.
    adminAuthorsToDelete.push(targetId);

    // Attribute one of the seeded books to the source.
    await db
      .insert(schema.bookMetadataAuthorMapping)
      .values({ bookId: seeded.books[3]!.id, authorId: sourceId });

    const res = await authedRequest(admin.bearer, "/api/v1/authors/merge", {
      method: "POST",
      json: { sourceId, targetId },
    });
    expect(res.status).toBe(200);

    // Source author should be gone.
    const remaining = await db
      .select({ id: schema.authors.id })
      .from(schema.authors)
      .where(eq(schema.authors.id, sourceId));
    expect(remaining.length).toBe(0);

    // Target should now own the book.
    const mappings = await db
      .select({ authorId: schema.bookMetadataAuthorMapping.authorId })
      .from(schema.bookMetadataAuthorMapping)
      .where(eq(schema.bookMetadataAuthorMapping.bookId, seeded.books[3]!.id));
    expect(mappings.some((m) => m.authorId === targetId)).toBe(true);
  });

});

// --------------------------------------------------------------------------
// series.ts
// --------------------------------------------------------------------------
describe("series", () => {
  test("GET /series requires auth", async () => {
    const res = await app.request("/api/v1/series");
    expect(res.status).toBe(401);
  });

  test("GET /series returns an array", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/series");
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    for (const s of list) {
      expect(typeof s.name).toBe("string");
      expect(typeof s.bookCount).toBe("number");
    }
  });

  test("GET /series/:name 404s for an unknown series", async () => {
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/series/${encodeURIComponent(TEST_PREFIX + "missing-" + crypto.randomUUID())}`,
    );
    expect(res.status).toBe(404);
  });

  test("GET /series surfaces a series after we seed books into it; /series/:name returns ordered books", async () => {
    // Build a tiny library + 3 books with the same seriesName at varying seriesNumber.
    const db = requireDb();
    const lib = await db
      .insert(schema.libraries)
      .values({ name: TEST_PREFIX + "ser-lib-" + crypto.randomUUID().slice(0, 6) })
      .returning();
    const libraryId = lib[0]!.id;
    createdSeriesLibraryIds.push(libraryId);

    await db.insert(schema.userLibraryMapping).values({ userId: primary.id, libraryId });
    const lp = await db
      .insert(schema.libraryPaths)
      .values({ libraryId, path: "/tmp/series-" + libraryId })
      .returning();
    const libraryPathId = lp[0]!.id;

    const seriesName = TEST_PREFIX + "Chronicles-" + crypto.randomUUID().slice(0, 6);
    const books = await db
      .insert(schema.books)
      .values([
        { libraryId, libraryPathId, fileName: "s1.epub", bookType: "EPUB" as const },
        { libraryId, libraryPathId, fileName: "s2.epub", bookType: "EPUB" as const },
        { libraryId, libraryPathId, fileName: "s3.epub", bookType: "EPUB" as const },
      ])
      .returning();
    for (const b of books) createdSeriesBookIds.push(b.id);

    // Inserted out of numeric order to assert handler sorts by seriesNumber.
    await db.insert(schema.bookMetadata).values([
      { bookId: books[0]!.id, title: "Three", seriesName, seriesNumber: 3 },
      { bookId: books[1]!.id, title: "One", seriesName, seriesNumber: 1 },
      { bookId: books[2]!.id, title: "Two", seriesName, seriesNumber: 2 },
    ]);

    // The series now appears in /series.
    const list = await authedRequest(primary.bearer, "/api/v1/series").then((r) => r.json());
    const ours = list.find((s: { name: string }) => s.name === seriesName);
    expect(ours).toBeTruthy();
    expect(ours.bookCount).toBe(3);

    // /series/:name returns books ordered by seriesNumber.
    const detail = await authedRequest(
      primary.bearer,
      `/api/v1/series/${encodeURIComponent(seriesName)}`,
    );
    expect(detail.status).toBe(200);
    const body = await detail.json();
    expect(body.name).toBe(seriesName);
    expect(body.books.map((b: { title: string }) => b.title)).toEqual(["One", "Two", "Three"]);
  });

  test("GET /series/:name scopes books to the requesting user's libraries (secondary user sees 404)", async () => {
    // Re-use a series that only primary has access to. The previous test created
    // one; create another here to keep tests independent.
    const db = requireDb();
    const lib = await db
      .insert(schema.libraries)
      .values({ name: TEST_PREFIX + "scope-lib-" + crypto.randomUUID().slice(0, 6) })
      .returning();
    const libraryId = lib[0]!.id;
    createdSeriesLibraryIds.push(libraryId);
    await db.insert(schema.userLibraryMapping).values({ userId: primary.id, libraryId });
    const lp = await db
      .insert(schema.libraryPaths)
      .values({ libraryId, path: "/tmp/scope-" + libraryId })
      .returning();
    const libraryPathId = lp[0]!.id;

    const seriesName = TEST_PREFIX + "Private-" + crypto.randomUUID().slice(0, 6);
    const inserted = await db
      .insert(schema.books)
      .values([{ libraryId, libraryPathId, fileName: "p1.epub", bookType: "EPUB" as const }])
      .returning();
    createdSeriesBookIds.push(inserted[0]!.id);
    await db
      .insert(schema.bookMetadata)
      .values({ bookId: inserted[0]!.id, title: "P1", seriesName, seriesNumber: 1 });

    // Primary can see it.
    const ok = await authedRequest(
      primary.bearer,
      `/api/v1/series/${encodeURIComponent(seriesName)}`,
    );
    expect(ok.status).toBe(200);

    // Secondary has no library mapping → empty books → 404 (handler short-circuits).
    const denied = await authedRequest(
      secondary.bearer,
      `/api/v1/series/${encodeURIComponent(seriesName)}`,
    );
    expect(denied.status).toBe(404);
  });

});
