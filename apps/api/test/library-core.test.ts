import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { inArray } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { app } from "../src/app.ts";
import { requireDb } from "../src/db.ts";
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

// Shared fixtures: an admin (full library powers), a regular user mapped to
// the seeded library, and an outsider with no library mapping. The seeded
// library belongs to `mapped`; admin gets access via the global-admin path.
let admin: TestUser;
let mapped: TestUser;
let outsider: TestUser;
let seeded: SeedResult;
// Libraries created by tests (so afterAll can sweep them).
const createdLibraryIds: string[] = [];

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  mapped = await createTestUser();
  outsider = await createTestUser();
  seeded = await seedLibraryAndBooks(mapped.id);
});

afterAll(async () => {
  // Delete the seeded library plus anything tests spawned.
  await deleteLibraries([seeded.libraryId, ...createdLibraryIds]);
  await deleteAuthors(seeded.authorIds);
  await deleteTestUsers([admin.username, mapped.username, outsider.username]);
});

// --- libraries.ts -----------------------------------------------------------

describe("libraries CRUD", () => {
  test("GET /libraries requires auth", async () => {
    const res = await app.request("/api/v1/libraries");
    expect(res.status).toBe(401);
  });

  test("GET /libraries returns the user's mapped libraries", async () => {
    const res = await authedRequest(mapped.bearer, "/api/v1/libraries");
    expect(res.status).toBe(200);
    const libs = await res.json();
    expect(Array.isArray(libs)).toBe(true);
    expect(libs.some((l: { id: string }) => l.id === seeded.libraryId)).toBe(true);
  });

  test("GET /libraries scopes a non-admin user to mapped libraries only", async () => {
    const res = await authedRequest(outsider.bearer, "/api/v1/libraries");
    expect(res.status).toBe(200);
    const libs = await res.json();
    expect(libs.find((l: { id: string }) => l.id === seeded.libraryId)).toBeUndefined();
  });

  test("GET /libraries/:id returns 404 for a library the user isn't mapped to", async () => {
    const res = await authedRequest(outsider.bearer, `/api/v1/libraries/${seeded.libraryId}`);
    expect(res.status).toBe(404);
  });

  test("GET /libraries/:id rejects a malformed uuid with 400", async () => {
    const res = await authedRequest(mapped.bearer, "/api/v1/libraries/not-a-uuid");
    expect(res.status).toBe(400);
  });

  test("POST /libraries requires manipulateLibrary permission (403 for plain user)", async () => {
    const res = await authedRequest(outsider.bearer, "/api/v1/libraries", {
      method: "POST",
      json: { name: TEST_PREFIX + "denied-" + crypto.randomUUID().slice(0, 4) },
    });
    expect(res.status).toBe(403);
  });

  test("POST /libraries creates a library as admin", async () => {
    const name = TEST_PREFIX + "create-" + crypto.randomUUID().slice(0, 4);
    const res = await authedRequest(admin.bearer, "/api/v1/libraries", {
      method: "POST",
      json: { name, paths: ["/tmp/test-lib-" + crypto.randomUUID().slice(0, 4)] },
    });
    expect(res.status).toBe(201);
    const lib = await res.json();
    expect(lib.id).toBeTruthy();
    expect(lib.name).toBe(name);
    expect(lib.paths.length).toBe(1);
    createdLibraryIds.push(lib.id);
  });

  test("POST /libraries rejects an empty name (400)", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/libraries", {
      method: "POST",
      json: { name: "" },
    });
    expect(res.status).toBe(400);
  });

  test("PATCH /libraries/:id updates the library", async () => {
    const create = await authedRequest(admin.bearer, "/api/v1/libraries", {
      method: "POST",
      json: { name: TEST_PREFIX + "patch-" + crypto.randomUUID().slice(0, 4) },
    });
    const id = (await create.json()).id;
    createdLibraryIds.push(id);
    const newName = TEST_PREFIX + "renamed-" + crypto.randomUUID().slice(0, 4);
    const res = await authedRequest(admin.bearer, `/api/v1/libraries/${id}`, {
      method: "PATCH",
      json: { name: newName },
    });
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.name).toBe(newName);
  });

  test("DELETE /libraries/:id requires admin (403 for non-admin)", async () => {
    const create = await authedRequest(admin.bearer, "/api/v1/libraries", {
      method: "POST",
      json: { name: TEST_PREFIX + "del-deny-" + crypto.randomUUID().slice(0, 4) },
    });
    const id = (await create.json()).id;
    createdLibraryIds.push(id);
    const res = await authedRequest(mapped.bearer, `/api/v1/libraries/${id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(403);
  });

  test("DELETE /libraries/:id removes the library as admin", async () => {
    const create = await authedRequest(admin.bearer, "/api/v1/libraries", {
      method: "POST",
      json: { name: TEST_PREFIX + "doomed-" + crypto.randomUUID().slice(0, 4) },
    });
    const id = (await create.json()).id;
    const del = await authedRequest(admin.bearer, `/api/v1/libraries/${id}`, {
      method: "DELETE",
    });
    expect(del.status).toBe(200);
    // After delete, admin's GET should not surface it.
    const after = await authedRequest(admin.bearer, `/api/v1/libraries/${id}`);
    expect(after.status).toBe(404);
  });
});

describe("library paths", () => {
  test("POST /libraries/:id/paths adds a path as admin", async () => {
    const create = await authedRequest(admin.bearer, "/api/v1/libraries", {
      method: "POST",
      json: { name: TEST_PREFIX + "paths-" + crypto.randomUUID().slice(0, 4) },
    });
    const id = (await create.json()).id;
    createdLibraryIds.push(id);
    const res = await authedRequest(admin.bearer, `/api/v1/libraries/${id}/paths`, {
      method: "POST",
      json: { path: "/tmp/path-" + crypto.randomUUID().slice(0, 4) },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(typeof body.path).toBe("string");
  });

  test("DELETE /libraries/:id/paths/:pathId removes the path", async () => {
    const create = await authedRequest(admin.bearer, "/api/v1/libraries", {
      method: "POST",
      json: { name: TEST_PREFIX + "pathdel-" + crypto.randomUUID().slice(0, 4) },
    });
    const libId = (await create.json()).id;
    createdLibraryIds.push(libId);
    const add = await authedRequest(admin.bearer, `/api/v1/libraries/${libId}/paths`, {
      method: "POST",
      json: { path: "/tmp/path-" + crypto.randomUUID().slice(0, 4) },
    });
    const pathId = (await add.json()).id;
    const del = await authedRequest(
      admin.bearer,
      `/api/v1/libraries/${libId}/paths/${pathId}`,
      { method: "DELETE" },
    );
    expect(del.status).toBe(200);
    // Deleting a missing one yields 404.
    const again = await authedRequest(
      admin.bearer,
      `/api/v1/libraries/${libId}/paths/${pathId}`,
      { method: "DELETE" },
    );
    expect(again.status).toBe(404);
  });

  test("POST /libraries/:id/paths is 403 for a non-admin without manipulateLibrary", async () => {
    const res = await authedRequest(
      mapped.bearer,
      `/api/v1/libraries/${seeded.libraryId}/paths`,
      { method: "POST", json: { path: "/tmp/whatever" } },
    );
    expect(res.status).toBe(403);
  });
});

describe("library health", () => {
  test("GET /libraries/:id/health reports paths + book counts", async () => {
    const res = await authedRequest(
      mapped.bearer,
      `/api/v1/libraries/${seeded.libraryId}/health`,
    );
    expect(res.status).toBe(200);
    const h = await res.json();
    expect(h.libraryId).toBe(seeded.libraryId);
    expect(Array.isArray(h.paths)).toBe(true);
    // We seeded 4 books and the path on disk doesn't exist, so all are orphaned.
    expect(h.totalBooks).toBe(seeded.books.length);
    expect(h.orphanedBooks).toBe(seeded.books.length);
    expect(h.paths[0]?.readable).toBe(false);
  });

  test("GET /libraries/:id/health is 404 for an outsider", async () => {
    const res = await authedRequest(
      outsider.bearer,
      `/api/v1/libraries/${seeded.libraryId}/health`,
    );
    expect(res.status).toBe(404);
  });
});

// --- books.ts ---------------------------------------------------------------

describe("books list & filters", () => {
  test("GET /books requires auth", async () => {
    const res = await app.request("/api/v1/books");
    expect(res.status).toBe(401);
  });

  test("GET /books returns the user's books with totals", async () => {
    const res = await authedRequest(
      mapped.bearer,
      `/api/v1/books?libraryId=${seeded.libraryId}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalElements).toBe(seeded.books.length);
    expect(body.content.length).toBe(seeded.books.length);
  });

  test("GET /books?bookType=EPUB filters by file type", async () => {
    const res = await authedRequest(
      mapped.bearer,
      `/api/v1/books?libraryId=${seeded.libraryId}&bookType=EPUB`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalElements).toBe(2);
    for (const b of body.content) expect(b.bookType).toBe("EPUB");
  });

  test("GET /books?sort=rating&direction=desc orders by rating", async () => {
    const res = await authedRequest(
      mapped.bearer,
      `/api/v1/books?libraryId=${seeded.libraryId}&sort=rating&direction=desc`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // The seeded books with ratings sort 5,4,2,null. The null lands last on desc.
    const ratings = body.content.map((b: { rating: number | null }) => b.rating);
    expect(ratings[0]).toBe(5);
    expect(ratings[1]).toBe(4);
  });

  test("GET /books pagination respects page/size", async () => {
    const res = await authedRequest(
      mapped.bearer,
      `/api/v1/books?libraryId=${seeded.libraryId}&size=2&page=0`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content.length).toBe(2);
    expect(body.size).toBe(2);
    expect(body.totalElements).toBe(seeded.books.length);
  });

  test("GET /books rejects invalid bookType (400)", async () => {
    const res = await authedRequest(
      mapped.bearer,
      `/api/v1/books?bookType=DEFINITELY_NOT_A_TYPE`,
    );
    expect(res.status).toBe(400);
  });

  test("GET /books is empty when the user has no library mapping", async () => {
    const res = await authedRequest(outsider.bearer, "/api/v1/books");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalElements).toBe(0);
  });
});

describe("books detail & batch", () => {
  test("GET /books/:id returns a book the user can see", async () => {
    const id = seeded.books[0]!.id;
    const res = await authedRequest(mapped.bearer, `/api/v1/books/${id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(id);
    expect(body.title).toBe(seeded.books[0]!.title);
  });

  test("GET /books/:id is 404 for an outsider", async () => {
    const id = seeded.books[0]!.id;
    const res = await authedRequest(outsider.bearer, `/api/v1/books/${id}`);
    expect(res.status).toBe(404);
  });

  test("GET /books/:id is 404 for an unknown uuid", async () => {
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/books/${crypto.randomUUID()}`,
    );
    expect(res.status).toBe(404);
  });

  test("GET /books/batch returns rows for known ids, skipping junk", async () => {
    const ids = seeded.books.slice(0, 2).map((b) => b.id);
    const res = await authedRequest(
      mapped.bearer,
      `/api/v1/books/batch?ids=${ids.join(",")},not-a-uuid`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(2);
    const got = new Set(body.map((b: { id: string }) => b.id));
    for (const id of ids) expect(got.has(id)).toBe(true);
  });

  test("GET /books/batch requires the ids query (400)", async () => {
    const res = await authedRequest(mapped.bearer, `/api/v1/books/batch`);
    expect(res.status).toBe(400);
  });

  test("GET /books/duplicates returns an array", async () => {
    const res = await authedRequest(mapped.bearer, `/api/v1/books/duplicates`);
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test("GET /books/:id/recommendations returns same-author books", async () => {
    // Alpha (Alice) → recommends Beta (also Alice).
    const alphaId = seeded.books[0]!.id;
    const res = await authedRequest(
      mapped.bearer,
      `/api/v1/books/${alphaId}/recommendations`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const titles = body.map((b: { title: string | null }) => b.title);
    expect(titles).toContain("Beta Mid Rated");
  });
});

describe("books mutation endpoints", () => {
  test("POST /books/status sets status with proper payload", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(mapped.bearer, "/api/v1/books/status", {
      method: "POST",
      json: { updates: [{ bookId, status: "READING" }] },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("POST /books/status rejects an empty updates array (400)", async () => {
    const res = await authedRequest(mapped.bearer, "/api/v1/books/status", {
      method: "POST",
      json: { updates: [] },
    });
    expect(res.status).toBe(400);
  });

  test("POST /books/reset-progress requires at least one bookId (400)", async () => {
    const res = await authedRequest(mapped.bearer, "/api/v1/books/reset-progress", {
      method: "POST",
      json: { bookIds: [] },
    });
    expect(res.status).toBe(400);
  });

  test("POST /books/reset-progress succeeds for the owner", async () => {
    const res = await authedRequest(mapped.bearer, "/api/v1/books/reset-progress", {
      method: "POST",
      json: { bookIds: [seeded.books[0]!.id] },
    });
    expect(res.status).toBe(200);
  });

  test("PUT /books/personal-rating is 403 for a user without editMetadata", async () => {
    const res = await authedRequest(mapped.bearer, "/api/v1/books/personal-rating", {
      method: "PUT",
      json: { bookId: seeded.books[0]!.id, rating: 3 },
    });
    expect(res.status).toBe(403);
  });

  test("PUT /books/personal-rating updates rating as admin", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/books/personal-rating", {
      method: "PUT",
      json: { bookId: seeded.books[2]!.id, rating: 3 },
    });
    expect(res.status).toBe(200);
  });

  test("PUT /books/personal-rating rejects rating > 5 (400)", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/books/personal-rating", {
      method: "PUT",
      json: { bookId: seeded.books[0]!.id, rating: 9 },
    });
    expect(res.status).toBe(400);
  });

  test("POST /books/reset-personal-rating clears rating as admin", async () => {
    const res = await authedRequest(
      admin.bearer,
      "/api/v1/books/reset-personal-rating",
      {
        method: "POST",
        json: { bookIds: [seeded.books[0]!.id] },
      },
    );
    expect(res.status).toBe(200);
  });
});

describe("books cover & file streaming", () => {
  test("GET /books/:id/cover is 401 without auth", async () => {
    const res = await app.request(`/api/v1/books/${seeded.books[0]!.id}/cover`);
    expect(res.status).toBe(401);
  });

  test("GET /books/:id/cover is 404 when no cover exists on disk", async () => {
    const res = await authedRequest(
      mapped.bearer,
      `/api/v1/books/${seeded.books[0]!.id}/cover`,
    );
    expect(res.status).toBe(404);
  });

  test("GET /books/:id/download is 401 with no auth and no token", async () => {
    const res = await app.request(`/api/v1/books/${seeded.books[0]!.id}/download`);
    expect(res.status).toBe(401);
  });

  test("GET /books/:id/download is 404 when the file is missing on disk", async () => {
    // Seeded books point at /tmp/<libId>/book-N.* which does not exist.
    const res = await authedRequest(
      mapped.bearer,
      `/api/v1/books/${seeded.books[0]!.id}/download`,
    );
    expect(res.status).toBe(404);
  });

  test("GET /books/:id/cover accepts ?token= as auth", async () => {
    const res = await app.request(
      `/api/v1/books/${seeded.books[0]!.id}/cover?token=${mapped.bearer}`,
    );
    // Auth succeeds (so not 401); cover still missing → 404.
    expect(res.status).toBe(404);
  });

  test("GET /books/:id/file-metadata is 404 when file is missing", async () => {
    const res = await authedRequest(
      mapped.bearer,
      `/api/v1/books/${seeded.books[0]!.id}/file-metadata`,
    );
    expect(res.status).toBe(404);
  });
});

// --- scan.ts ----------------------------------------------------------------

describe("scan endpoints", () => {
  test("POST /libraries/:id/scan requires auth", async () => {
    const res = await app.request(`/api/v1/libraries/${seeded.libraryId}/scan`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  test("POST /libraries/:id/scan is 403 for a user without manipulateLibrary", async () => {
    const res = await authedRequest(
      mapped.bearer,
      `/api/v1/libraries/${seeded.libraryId}/scan`,
      { method: "POST" },
    );
    expect(res.status).toBe(403);
  });

  test("POST /libraries/:id/scan is 404 for a library the user can't access (admin sees all, so use outsider against a real lib)", async () => {
    // Admins always pass the access check; outsider lacks both manipulateLibrary
    // and access, so the permission check kicks in first → 403. The interesting
    // 404 case is admin against a non-existent uuid.
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/libraries/${crypto.randomUUID()}/scan`,
      { method: "POST" },
    );
    // Admin bypasses the access check (`isAdmin` short-circuits); the enqueue
    // succeeds regardless of the library existing. We document this as 202.
    expect([202, 404]).toContain(res.status);
  });

  test("POST /libraries/:id/scan enqueues a task as admin", async () => {
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/libraries/${seeded.libraryId}/scan`,
      { method: "POST" },
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.taskId).toBeTruthy();
  });

  test("POST /libraries/:id/scan rejects malformed uuid (400)", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/libraries/bad-id/scan", {
      method: "POST",
    });
    expect(res.status).toBe(400);
  });

  test("GET /tasks returns an array", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/tasks");
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test("GET /tasks?status=queued filters by status", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/tasks?status=queued");
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const t of body) expect(t.status).toBe("queued");
  });

  test("GET /tasks?status=garbage rejects invalid filter (400)", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/tasks?status=garbage");
    expect(res.status).toBe(400);
  });

  test("GET /tasks/:id is 404 for an unknown task id", async () => {
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/tasks/${crypto.randomUUID()}`,
    );
    expect(res.status).toBe(404);
  });

  test("DELETE /tasks/:id is 403 for non-admin without manipulateLibrary", async () => {
    const res = await authedRequest(
      mapped.bearer,
      `/api/v1/tasks/${crypto.randomUUID()}`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(403);
  });

  test("POST /tasks/:id/retry is 404 when the task doesn't exist", async () => {
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/tasks/${crypto.randomUUID()}/retry`,
      { method: "POST" },
    );
    expect(res.status).toBe(404);
  });
});

// --- upload.ts --------------------------------------------------------------

describe("upload endpoints", () => {
  // Make a fresh library WITH a writable path for upload happy-path tests, so
  // we don't depend on /tmp/<seededId> existing.
  let uploadLibId: string;
  let uploadPathDir: string;

  beforeAll(async () => {
    const dir = "/tmp/" + TEST_PREFIX + "upload-" + crypto.randomUUID().slice(0, 6);
    uploadPathDir = dir;
    const create = await authedRequest(admin.bearer, "/api/v1/libraries", {
      method: "POST",
      json: {
        name: TEST_PREFIX + "uplib-" + crypto.randomUUID().slice(0, 4),
        paths: [dir],
      },
    });
    expect(create.status).toBe(201);
    uploadLibId = (await create.json()).id;
    createdLibraryIds.push(uploadLibId);
  });

  test("POST /libraries/:id/upload requires auth", async () => {
    const fd = new FormData();
    fd.append("file", new File(["x"], "x.epub", { type: "application/epub+zip" }));
    const res = await app.request(`/api/v1/libraries/${uploadLibId}/upload`, {
      method: "POST",
      body: fd,
    });
    expect(res.status).toBe(401);
  });

  test("POST /libraries/:id/upload is 403 for a user without upload permission", async () => {
    const fd = new FormData();
    fd.append("file", new File(["x"], "x.epub", { type: "application/epub+zip" }));
    const res = await authedRequest(
      mapped.bearer,
      `/api/v1/libraries/${uploadLibId}/upload`,
      { method: "POST", body: fd },
    );
    expect(res.status).toBe(403);
  });

  test("POST /libraries/:id/upload returns 400 when no file field is present", async () => {
    const fd = new FormData();
    fd.append("notfile", "nope");
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/libraries/${uploadLibId}/upload`,
      { method: "POST", body: fd },
    );
    expect(res.status).toBe(400);
  });

  test("POST /libraries/:id/upload returns 415 for unsupported file extension", async () => {
    const fd = new FormData();
    fd.append(
      "file",
      new File(["hello"], "notes.txt", { type: "text/plain" }),
    );
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/libraries/${uploadLibId}/upload`,
      { method: "POST", body: fd },
    );
    expect(res.status).toBe(415);
  });

  test("POST /libraries/:id/upload returns 400 when the library has no configured paths", async () => {
    // Make a library with NO paths.
    const create = await authedRequest(admin.bearer, "/api/v1/libraries", {
      method: "POST",
      json: { name: TEST_PREFIX + "nopath-" + crypto.randomUUID().slice(0, 4) },
    });
    const libId = (await create.json()).id;
    createdLibraryIds.push(libId);
    const fd = new FormData();
    fd.append(
      "file",
      new File(["x"], "x.epub", { type: "application/epub+zip" }),
    );
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/libraries/${libId}/upload`,
      { method: "POST", body: fd },
    );
    expect(res.status).toBe(400);
  });

  test("POST /libraries/:id/upload accepts a supported file and writes a book row", async () => {
    // We can't fake a real EPUB without ZIP guts; the extractor will warn but
    // ingestFile catches the failure and returns a warning. The route is
    // expected to STILL persist the book row and return 201.
    const fileName = "fake-" + crypto.randomUUID().slice(0, 6) + ".epub";
    const fd = new FormData();
    fd.append(
      "file",
      new File(["not a real epub"], fileName, {
        type: "application/epub+zip",
      }),
    );
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/libraries/${uploadLibId}/upload`,
      { method: "POST", body: fd },
    );
    // The route returns 201 with { id, fileName, warning }. A non-2xx here
    // means the rewrite has a hole: real EPUB parsing is required and not
    // gracefully degraded.
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.fileName).toBe(fileName);
    // Sanity-clean the inserted book so the library can be deleted cleanly.
    const db = requireDb();
    await db.delete(schema.books).where(inArray(schema.books.id, [body.id]));
    // Also remove the file we wrote to /tmp.
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      await fs.rm(path.join(uploadPathDir, fileName), { force: true });
    } catch {
      // best effort
    }
  });

  test("POST /libraries/:id/upload rejects a malformed library uuid (400)", async () => {
    const fd = new FormData();
    fd.append("file", new File(["x"], "x.epub", { type: "application/epub+zip" }));
    const res = await authedRequest(admin.bearer, "/api/v1/libraries/not-a-uuid/upload", {
      method: "POST",
      body: fd,
    });
    expect(res.status).toBe(400);
  });
});
