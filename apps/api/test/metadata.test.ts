import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../src/db.ts";
import { app } from "../src/app.ts";
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

// Two users:
//  - admin: passes requireEditMetadata (writes to book metadata, sidecars,
//    refresh-tasks).
//  - reader: regular user, used to assert 403 and per-user scoping for
//    reviews / hardcover / komga settings.
let admin: TestUser;
let reader: TestUser;
let seeded: SeedResult;
// Track shelves we create inline so afterAll can clean up — helpers.ts
// doesn't expose a shelf-delete helper and we must not modify it.
const createdShelfIds: string[] = [];

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  reader = await createTestUser();
  seeded = await seedLibraryAndBooks(admin.id);
});

afterAll(async () => {
  // Wipe inline-created shelves (none of them ship with the seed).
  if (createdShelfIds.length) {
    const db = requireDb();
    for (const id of createdShelfIds) {
      await db.delete(schema.shelves).where(eq(schema.shelves.id, id));
    }
  }
  await deleteLibraries([seeded.libraryId]);
  await deleteAuthors(seeded.authorIds);
  await deleteTestUsers([admin.username, reader.username]);
});

// ---------------------------------------------------------------------------
// metadata.ts — book metadata get/set, refresh, providers
// ---------------------------------------------------------------------------

describe("metadata: providers + search", () => {
  test("GET /metadata/providers lists the registered providers", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/metadata/providers");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // google-books ships in registry by default.
    const ids = body.map((p: { id: string }) => p.id);
    expect(ids).toContain("google-books");
    for (const p of body) {
      expect(typeof p.id).toBe("string");
      expect(typeof p.name).toBe("string");
    }
  });

  test("GET /metadata/providers requires auth", async () => {
    const res = await app.request("/api/v1/metadata/providers");
    expect(res.status).toBe(401);
  });

  test("GET /metadata/search rejects an out-of-range limit", async () => {
    // Schema clamp: 1 <= limit <= 40. "999" should 400.
    const res = await authedRequest(
      admin.bearer,
      "/api/v1/metadata/search?title=test&limit=999",
    );
    expect(res.status).toBe(400);
  });

  test("GET /metadata/search rejects a non-integer limit", async () => {
    const res = await authedRequest(
      admin.bearer,
      "/api/v1/metadata/search?title=test&limit=abc",
    );
    expect(res.status).toBe(400);
  });

  test("GET /metadata/search returns a {matches, errors} envelope for valid params", async () => {
    // External call: don't assert content. Just shape + reachability.
    const res = await authedRequest(
      admin.bearer,
      "/api/v1/metadata/search?title=Pride+and+Prejudice&limit=1",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.matches)).toBe(true);
    expect(Array.isArray(body.errors)).toBe(true);
  });
});

describe("metadata: PUT /books/:id/metadata", () => {
  test("403 for non-admin without editMetadata permission", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(reader.bearer, `/api/v1/books/${bookId}/metadata`, {
      method: "PUT",
      json: { title: "Should Not Apply" },
    });
    expect(res.status).toBe(403);
  });

  test("400 on excess / unknown field (arktype is strict)", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(admin.bearer, `/api/v1/books/${bookId}/metadata`, {
      method: "PUT",
      json: { somethingNotInSchema: "x" },
    });
    expect(res.status).toBe(400);
  });

  test("400 on invalid uuid in path", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/books/not-a-uuid/metadata", {
      method: "PUT",
      json: { title: "x" },
    });
    expect(res.status).toBe(400);
  });

  test("PUT applies scalar fields and persists", async () => {
    const bookId = seeded.books[2]!.id; // Gamma Low Rated
    const newDesc = TEST_PREFIX + "desc-" + crypto.randomUUID().slice(0, 6);
    const res = await authedRequest(admin.bearer, `/api/v1/books/${bookId}/metadata`, {
      method: "PUT",
      json: { description: newDesc, publisher: "Tsundoku Test Co" },
    });
    expect(res.status).toBe(200);

    const db = requireDb();
    const rows = await db
      .select()
      .from(schema.bookMetadata)
      .where(eq(schema.bookMetadata.bookId, bookId))
      .limit(1);
    expect(rows[0]?.description).toBe(newDesc);
    expect(rows[0]?.publisher).toBe("Tsundoku Test Co");
  });

  test("PUT replaces authors via the mapping table", async () => {
    const bookId = seeded.books[3]!.id; // Delta No Rating — no authors initially
    const newAuthor = TEST_PREFIX + "author-" + crypto.randomUUID().slice(0, 6);
    const res = await authedRequest(admin.bearer, `/api/v1/books/${bookId}/metadata`, {
      method: "PUT",
      json: { authors: [newAuthor] },
    });
    expect(res.status).toBe(200);

    const db = requireDb();
    const rows = await db
      .select({ name: schema.authors.name })
      .from(schema.bookMetadataAuthorMapping)
      .innerJoin(
        schema.authors,
        eq(schema.authors.id, schema.bookMetadataAuthorMapping.authorId),
      )
      .where(eq(schema.bookMetadataAuthorMapping.bookId, bookId));
    expect(rows.map((r) => r.name)).toContain(newAuthor);

    // Track this author for cleanup — it's referenced by FK from the mapping
    // we just inserted, so we let cascade-on-library-delete handle it, but
    // remove the author row explicitly to keep authors table clean.
    const created = await db
      .select({ id: schema.authors.id })
      .from(schema.authors)
      .where(eq(schema.authors.name, newAuthor));
    if (created[0]) seeded.authorIds.push(created[0].id);
  });
});

describe("metadata: per-book search + apply + lock + refresh", () => {
  test("GET /books/:id/metadata/search returns the {matches, errors} envelope", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/books/${bookId}/metadata/search`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.matches)).toBe(true);
    expect(Array.isArray(body.errors)).toBe(true);
  });

  test("POST /books/:id/metadata/apply requires editMetadata", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(
      reader.bearer,
      `/api/v1/books/${bookId}/metadata/apply`,
      {
        method: "POST",
        json: { match: { providerId: "google-books", externalId: "x" } },
      },
    );
    expect(res.status).toBe(403);
  });

  test("POST /books/:id/metadata/apply 400s on missing 'match' field", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/books/${bookId}/metadata/apply`,
      { method: "POST", json: {} },
    );
    expect(res.status).toBe(400);
  });

  test("POST /books/:id/metadata/apply persists fields from the provided match", async () => {
    const bookId = seeded.books[2]!.id; // Gamma
    const newTitle = TEST_PREFIX + "applied-" + crypto.randomUUID().slice(0, 6);
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/books/${bookId}/metadata/apply`,
      {
        method: "POST",
        json: {
          match: {
            providerId: "google-books",
            externalId: "test-external-id",
            title: newTitle,
            description: "from-apply",
          },
          applyCover: false,
        },
      },
    );
    expect(res.status).toBe(200);

    const db = requireDb();
    const rows = await db
      .select({
        title: schema.bookMetadata.title,
        description: schema.bookMetadata.description,
      })
      .from(schema.bookMetadata)
      .where(eq(schema.bookMetadata.bookId, bookId))
      .limit(1);
    expect(rows[0]?.title).toBe(newTitle);
    expect(rows[0]?.description).toBe("from-apply");
  });

  test("PUT /books/:id/metadata/lock sets a per-field lock; subsequent apply respects it", async () => {
    const bookId = seeded.books[1]!.id; // Beta Mid Rated
    const lockRes = await authedRequest(
      admin.bearer,
      `/api/v1/books/${bookId}/metadata/lock`,
      { method: "PUT", json: { field: "title", locked: true } },
    );
    expect(lockRes.status).toBe(200);

    // Apply a match with a different title — should be ignored due to lock.
    const lockedTitle = "Beta Mid Rated";
    const applyRes = await authedRequest(
      admin.bearer,
      `/api/v1/books/${bookId}/metadata/apply`,
      {
        method: "POST",
        json: {
          match: {
            providerId: "google-books",
            externalId: "x",
            title: "DIFFERENT TITLE",
            description: "but description still applies",
          },
          applyCover: false,
        },
      },
    );
    expect(applyRes.status).toBe(200);

    const db = requireDb();
    const rows = await db
      .select({
        title: schema.bookMetadata.title,
        description: schema.bookMetadata.description,
        titleLocked: schema.bookMetadata.titleLocked,
      })
      .from(schema.bookMetadata)
      .where(eq(schema.bookMetadata.bookId, bookId))
      .limit(1);
    expect(rows[0]?.titleLocked).toBe(true);
    expect(rows[0]?.title).toBe(lockedTitle);
    expect(rows[0]?.description).toBe("but description still applies");
  });

  test("PUT /books/:id/metadata/lock 400s on unknown field name", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/books/${bookId}/metadata/lock`,
      { method: "PUT", json: { field: "definitelyNotAField", locked: true } },
    );
    expect(res.status).toBe(400);
  });

  test("POST /books/:id/metadata/refresh returns an {applied, reason?} envelope", async () => {
    // External: don't assert applied=true. The provider may or may not return
    // a match for our garbage seed titles; we just want a structured reply.
    const bookId = seeded.books[3]!.id;
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/books/${bookId}/metadata/refresh`,
      { method: "POST" },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.applied).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// metadata-tasks.ts — bulk refresh enqueue endpoints
// ---------------------------------------------------------------------------

describe("metadata-tasks: refresh-books", () => {
  test("400 on empty bookIds array", async () => {
    const res = await authedRequest(
      admin.bearer,
      "/api/v1/metadata/tasks/refresh-books",
      { method: "POST", json: { bookIds: [] } },
    );
    expect(res.status).toBe(400);
  });

  test("400 on missing bookIds field", async () => {
    const res = await authedRequest(
      admin.bearer,
      "/api/v1/metadata/tasks/refresh-books",
      { method: "POST", json: {} },
    );
    expect(res.status).toBe(400);
  });

  test("400 on a non-uuid in bookIds", async () => {
    const res = await authedRequest(
      admin.bearer,
      "/api/v1/metadata/tasks/refresh-books",
      { method: "POST", json: { bookIds: ["not-a-uuid"] } },
    );
    expect(res.status).toBe(400);
  });

  test("403 for non-admin without editMetadata permission", async () => {
    const res = await authedRequest(
      reader.bearer,
      "/api/v1/metadata/tasks/refresh-books",
      { method: "POST", json: { bookIds: [seeded.books[0]!.id] } },
    );
    expect(res.status).toBe(403);
  });

  test("202 + {batchId, taskIds} for a valid bookIds list", async () => {
    const res = await authedRequest(
      admin.bearer,
      "/api/v1/metadata/tasks/refresh-books",
      {
        method: "POST",
        json: { bookIds: [seeded.books[0]!.id, seeded.books[1]!.id] },
      },
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(typeof body.batchId).toBe("string");
    expect(Array.isArray(body.taskIds)).toBe(true);
    expect(body.taskIds.length).toBe(2);
  });

  test("non-existent uuids are silently dropped, returning an empty taskIds list", async () => {
    const ghostId = crypto.randomUUID();
    const res = await authedRequest(
      admin.bearer,
      "/api/v1/metadata/tasks/refresh-books",
      { method: "POST", json: { bookIds: [ghostId] } },
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.taskIds.length).toBe(0);
  });
});

describe("metadata-tasks: refresh-library / refresh-shelf", () => {
  test("refresh-library 202s with one taskId per book in the library", async () => {
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/metadata/tasks/refresh-library/${seeded.libraryId}`,
      { method: "POST" },
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.taskIds.length).toBe(seeded.books.length);
  });

  test("refresh-shelf 404s for an unknown shelf id", async () => {
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/metadata/tasks/refresh-shelf/${crypto.randomUUID()}`,
      { method: "POST" },
    );
    expect(res.status).toBe(404);
  });

  test("refresh-shelf 202s for a real shelf (even if empty)", async () => {
    // Create an empty shelf row directly so we can exercise the route without
    // shipping a shelves-API call through here.
    const db = requireDb();
    const inserted = await db
      .insert(schema.shelves)
      .values({
        name: TEST_PREFIX + "shelf-" + crypto.randomUUID().slice(0, 6),
        userId: admin.id,
      })
      .returning({ id: schema.shelves.id });
    const shelfId = inserted[0]!.id;
    createdShelfIds.push(shelfId);

    const res = await authedRequest(
      admin.bearer,
      `/api/v1/metadata/tasks/refresh-shelf/${shelfId}`,
      { method: "POST" },
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.taskIds.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// reviews.ts — book reviews CRUD, scoping by book + user
// ---------------------------------------------------------------------------

describe("reviews CRUD", () => {
  test("GET /books/:id/reviews returns [] when no public reviews exist", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(reader.bearer, `/api/v1/books/${bookId}/reviews`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("POST /books/:id/reviews 400s on missing body field", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(reader.bearer, `/api/v1/books/${bookId}/reviews`, {
      method: "POST",
      json: { title: "no body" },
    });
    expect(res.status).toBe(400);
  });

  test("POST /books/:id/reviews 400s on empty body string", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(reader.bearer, `/api/v1/books/${bookId}/reviews`, {
      method: "POST",
      json: { body: "" },
    });
    expect(res.status).toBe(400);
  });

  test("POST /books/:id/reviews 400s on rating out of 0..5 range", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(reader.bearer, `/api/v1/books/${bookId}/reviews`, {
      method: "POST",
      json: { body: "I quite enjoyed it.", rating: 99 },
    });
    expect(res.status).toBe(400);
  });

  test("POST creates a private review by default; not visible in public listing", async () => {
    const bookId = seeded.books[1]!.id;
    const res = await authedRequest(reader.bearer, `/api/v1/books/${bookId}/reviews`, {
      method: "POST",
      json: { body: "Private musings.", rating: 4 },
    });
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.userId).toBe(reader.id);
    expect(created.isPublic).toBe(false);

    const list = await authedRequest(reader.bearer, `/api/v1/books/${bookId}/reviews`).then((r) => r.json());
    expect(list.find((r: { id: string }) => r.id === created.id)).toBeUndefined();
  });

  test("GET /books/:id/my-review returns the caller's review (private or public)", async () => {
    const bookId = seeded.books[2]!.id;
    const post = await authedRequest(reader.bearer, `/api/v1/books/${bookId}/reviews`, {
      method: "POST",
      json: { body: "mine!", isPublic: false },
    });
    expect(post.status).toBe(201);

    const mine = await authedRequest(reader.bearer, `/api/v1/books/${bookId}/my-review`);
    expect(mine.status).toBe(200);
    const body = await mine.json();
    expect(body.userId).toBe(reader.id);
    expect(body.body).toBe("mine!");
  });

  test("GET /books/:id/my-review returns null when the caller has no review", async () => {
    const bookId = seeded.books[3]!.id;
    const res = await authedRequest(admin.bearer, `/api/v1/books/${bookId}/my-review`);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  test("Public review IS surfaced in GET /books/:id/reviews", async () => {
    const bookId = seeded.books[3]!.id;
    const post = await authedRequest(reader.bearer, `/api/v1/books/${bookId}/reviews`, {
      method: "POST",
      json: { body: "Public thoughts.", isPublic: true, rating: 5 },
    });
    expect(post.status).toBe(201);
    const created = await post.json();

    const list = await authedRequest(reader.bearer, `/api/v1/books/${bookId}/reviews`).then((r) => r.json());
    expect(list.find((r: { id: string }) => r.id === created.id)).toBeDefined();
  });

  test("PUT /reviews/:reviewId updates the caller's own review", async () => {
    const bookId = seeded.books[0]!.id;
    const post = await authedRequest(reader.bearer, `/api/v1/books/${bookId}/reviews`, {
      method: "POST",
      json: { body: "Initial." },
    });
    const id = (await post.json()).id;

    const put = await authedRequest(reader.bearer, `/api/v1/reviews/${id}`, {
      method: "PUT",
      json: { body: "Updated.", rating: 3 },
    });
    expect(put.status).toBe(200);

    const db = requireDb();
    const rows = await db
      .select()
      .from(schema.bookReviews)
      .where(eq(schema.bookReviews.id, id))
      .limit(1);
    expect(rows[0]?.body).toBe("Updated.");
    expect(rows[0]?.rating).toBe(3);
  });

  test("PUT /reviews/:reviewId 404s when attempting to update another user's review", async () => {
    const bookId = seeded.books[0]!.id;
    // reader posts.
    const post = await authedRequest(reader.bearer, `/api/v1/books/${bookId}/reviews`, {
      method: "POST",
      json: { body: "Reader's review." },
    });
    const id = (await post.json()).id;

    // admin tries to update — owner mismatch should 404 (not leak existence).
    const put = await authedRequest(admin.bearer, `/api/v1/reviews/${id}`, {
      method: "PUT",
      json: { body: "Hacked!" },
    });
    expect(put.status).toBe(404);
  });

  test("DELETE /reviews/:reviewId removes the caller's review", async () => {
    const bookId = seeded.books[0]!.id;
    const post = await authedRequest(reader.bearer, `/api/v1/books/${bookId}/reviews`, {
      method: "POST",
      json: { body: "Doomed." },
    });
    const id = (await post.json()).id;

    const del = await authedRequest(reader.bearer, `/api/v1/reviews/${id}`, {
      method: "DELETE",
    });
    expect(del.status).toBe(200);

    const del2 = await authedRequest(reader.bearer, `/api/v1/reviews/${id}`, {
      method: "DELETE",
    });
    expect(del2.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// hardcover.ts — settings + sync stub
// ---------------------------------------------------------------------------

describe("hardcover", () => {
  test("GET /hardcover/settings starts unconfigured for a new user", async () => {
    const res = await authedRequest(reader.bearer, "/api/v1/hardcover/settings");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(false);
    expect(body.syncEnabled).toBe(false);
    expect(body.lastSyncAt).toBeNull();
  });

  test("PUT then GET surfaces configured=true and the chosen syncEnabled state", async () => {
    const put = await authedRequest(reader.bearer, "/api/v1/hardcover/settings", {
      method: "PUT",
      json: { apiToken: "hc_test_token_" + crypto.randomUUID().slice(0, 6), syncEnabled: true },
    });
    expect(put.status).toBe(200);

    const get = await authedRequest(reader.bearer, "/api/v1/hardcover/settings");
    const body = await get.json();
    expect(body.configured).toBe(true);
    expect(body.syncEnabled).toBe(true);
  });

  test("PUT does NOT echo the api token back (it stays server-side)", async () => {
    const get = await authedRequest(reader.bearer, "/api/v1/hardcover/settings");
    const body = await get.json();
    expect("apiToken" in body).toBe(false);
  });

  test("POST /hardcover/sync returns 501 (runner not yet implemented)", async () => {
    const res = await authedRequest(reader.bearer, "/api/v1/hardcover/sync", {
      method: "POST",
    });
    expect(res.status).toBe(501);
  });

  test("auth required on /hardcover/settings", async () => {
    const res = await app.request("/api/v1/hardcover/settings");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// komga.ts — settings + connectivity test + sync stub
// ---------------------------------------------------------------------------

describe("komga", () => {
  test("GET /komga/settings starts unconfigured for a new user", async () => {
    const res = await authedRequest(reader.bearer, "/api/v1/komga/settings");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(false);
    expect(body.baseUrl).toBeNull();
  });

  test("PUT /komga/settings 400s on a non-URL baseUrl", async () => {
    const res = await authedRequest(reader.bearer, "/api/v1/komga/settings", {
      method: "PUT",
      json: { baseUrl: "not a url" },
    });
    expect(res.status).toBe(400);
  });

  test("PUT /komga/settings persists; GET reflects configured=true and the saved baseUrl", async () => {
    const put = await authedRequest(reader.bearer, "/api/v1/komga/settings", {
      method: "PUT",
      json: { baseUrl: "https://komga.example/", username: "u", password: "p" },
    });
    expect(put.status).toBe(200);

    const get = await authedRequest(reader.bearer, "/api/v1/komga/settings");
    const body = await get.json();
    expect(body.configured).toBe(true);
    expect(body.baseUrl).toBe("https://komga.example/");
    expect(body.username).toBe("u");
    // Password must never come back over the wire.
    expect("password" in body).toBe(false);
  });

  test("POST /komga/test 400s on a non-URL baseUrl", async () => {
    const res = await authedRequest(reader.bearer, "/api/v1/komga/test", {
      method: "POST",
      json: { baseUrl: "definitely not a url" },
    });
    expect(res.status).toBe(400);
  });

  test("POST /komga/test against an unreachable URL returns a structured ok=false", async () => {
    // No Komga server configured in test env — assert we get a sensible body,
    // not a 500.
    const res = await authedRequest(reader.bearer, "/api/v1/komga/test", {
      method: "POST",
      json: { baseUrl: "http://127.0.0.1:1/" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(typeof body.status).toBe("number");
  });

  test("POST /komga/sync returns 501 (runner not yet implemented)", async () => {
    const res = await authedRequest(reader.bearer, "/api/v1/komga/sync", {
      method: "POST",
    });
    expect(res.status).toBe(501);
  });
});

// ---------------------------------------------------------------------------
// sidecar.ts — read/import/export sidecar files
// ---------------------------------------------------------------------------

describe("sidecar", () => {
  // The seeded library path is `/tmp/<libraryId>` — a directory we never
  // actually create. readSidecars walks that path and gets nothing; that's the
  // correct no-op behavior to assert.

  test("GET /books/:id/sidecars returns the no-sidecar shape when none exist on disk", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(admin.bearer, `/api/v1/books/${bookId}/sidecars`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasCover).toBe(false);
    expect(body.hasOpf).toBe(false);
    expect(body.hasMetadataJson).toBe(false);
    expect(body.metadataJson).toBeNull();
  });

  test("GET /books/:id/sidecars 400s on a non-uuid book id", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/books/not-a-uuid/sidecars");
    expect(res.status).toBe(400);
  });

  test("GET /books/:id/sidecars requires auth", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await app.request(`/api/v1/books/${bookId}/sidecars`);
    expect(res.status).toBe(401);
  });

  test("POST /books/:id/sidecars/import requires editMetadata permission", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(
      reader.bearer,
      `/api/v1/books/${bookId}/sidecars/import`,
      { method: "POST" },
    );
    expect(res.status).toBe(403);
  });

  test("POST /books/:id/sidecars/import on a book with no sidecars on disk returns false flags", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/books/${bookId}/sidecars/import`,
      { method: "POST" },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.coverImported).toBe(false);
    expect(body.metadataJsonImported).toBe(false);
  });

  test("POST /books/:id/sidecars/export requires editMetadata permission", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(
      reader.bearer,
      `/api/v1/books/${bookId}/sidecars/export`,
      { method: "POST" },
    );
    expect(res.status).toBe(403);
  });

  // NOTE: We do not test the happy path of POST /books/:id/sidecars/export
  // because exportSidecars writes to the filesystem next to the (seeded,
  // synthetic) book file — that directory doesn't exist and the test would
  // either need to scaffold one or accept a route-side filesystem error.
  // Both are out of scope for an integration test that doesn't have a real
  // library on disk. See report.
});
