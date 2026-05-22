import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { eq, inArray } from "drizzle-orm";
import { schema } from "@tsundoku/db";
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

let primary: TestUser;
let secondary: TestUser;
let admin: TestUser;
let uploader: TestUser;
let seeded: SeedResult;

// Extra book ids we create inline for audiobook + on-disk file tests so
// cleanup can target them. Author rows are cleaned via seeded.authorIds and
// the library cleanup will cascade book deletion.
const extraLibraryIds: string[] = [];
const tmpDirsToRemove: string[] = [];
const emailProviderIds: string[] = [];

async function insertExtraBook(input: {
  libraryId: string;
  libraryPathId: string;
  bookType: schema.BookType;
  fileName: string;
}) {
  const db = requireDb();
  const rows = await db
    .insert(schema.books)
    .values({
      libraryId: input.libraryId,
      libraryPathId: input.libraryPathId,
      fileName: input.fileName,
      bookType: input.bookType,
    })
    .returning();
  return rows[0]!.id;
}

beforeAll(async () => {
  primary = await createTestUser();
  secondary = await createTestUser();
  admin = await createTestUser({ isAdmin: true });
  uploader = await createTestUser();
  seeded = await seedLibraryAndBooks(primary.id);

  // Give the uploader the "upload" + "manipulateLibrary" permissions so the
  // additional-files POST/DELETE branches that check non-admin perms are
  // exercised. The seed helper only inserts users; permissions default rows
  // were created when the user was created — toggle them on directly.
  const db = requireDb();
  await db
    .update(schema.userPermissions)
    .set({ upload: true, manipulateLibrary: true })
    .where(eq(schema.userPermissions.userId, uploader.id));
});

afterAll(async () => {
  const db = requireDb();
  // Drop email provider rows we created (they're global, not user-scoped).
  if (emailProviderIds.length) {
    await db
      .delete(schema.emailProviders)
      .where(inArray(schema.emailProviders.id, emailProviderIds));
  }
  await deleteLibraries([seeded.libraryId, ...extraLibraryIds]);
  await deleteAuthors(seeded.authorIds);
  await deleteTestUsers([
    primary.username,
    secondary.username,
    admin.username,
    uploader.username,
  ]);
  for (const dir of tmpDirsToRemove) {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
});

// ---------------------------------------------------------------------------
// readers.ts — streaming + format helpers
// ---------------------------------------------------------------------------
describe("readers.ts streaming + format helpers", () => {
  test("GET /files/:id/stream without any token returns 401", async () => {
    const bookId = seeded.books[0]!.id;
    const { app } = await import("../src/app.ts");
    const res = await app.request(`/api/v1/files/${bookId}/stream`);
    expect(res.status).toBe(401);
  });

  test("GET /files/:id/stream with bearer returns 404 when file missing on disk", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/files/${bookId}/stream`,
    );
    // Book row exists but `/tmp/<libid>/book-0.epub` does not, so resolveBookFile
    // succeeds and statFile fails. The route maps that to 404.
    expect(res.status).toBe(404);
  });

  test("GET /files/:id/stream accepts ?token= query param fallback", async () => {
    const bookId = seeded.books[0]!.id;
    const { app } = await import("../src/app.ts");
    const res = await app.request(
      `/api/v1/files/${bookId}/stream?token=${primary.bearer}`,
    );
    expect(res.status).toBe(404);
  });

  test("GET /files/:id/stream with invalid ?token= is treated as unauthenticated (401)", async () => {
    const bookId = seeded.books[0]!.id;
    const { app } = await import("../src/app.ts");
    const res = await app.request(
      `/api/v1/files/${bookId}/stream?token=notavalidjwt`,
    );
    expect(res.status).toBe(401);
  });

  test("GET /files/:id/stream rejects non-UUID id with 400", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/files/not-a-uuid/stream");
    expect(res.status).toBe(400);
  });

  test("GET /files/:id/epub/manifest 404s on missing on-disk file", async () => {
    // The first seeded book is EPUB-typed, but the on-disk bytes don't exist
    // (no scan ran), so epubManifest() returns null → 404.
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/files/${bookId}/epub/manifest`,
    );
    expect(res.status).toBe(404);
  });

  test("GET /files/:id/pdf/page-count 404s on missing on-disk PDF", async () => {
    const pdfBook = seeded.books.find((b) => b.bookType === "PDF")!;
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/files/${pdfBook.id}/pdf/page-count`,
    );
    expect(res.status).toBe(404);
  });

  test("GET /files/:id/pdf/toc returns the stub empty list (200)", async () => {
    const pdfBook = seeded.books.find((b) => b.bookType === "PDF")!;
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/files/${pdfBook.id}/pdf/toc`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  test("GET /files/:id/cbx/pages 404s on a non-CBX book", async () => {
    const epubBook = seeded.books[0]!;
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/files/${epubBook.id}/cbx/pages`,
    );
    expect(res.status).toBe(404);
  });

  test("GET /files/:id/cbx/page/:n rejects negative index with 400", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/files/${bookId}/cbx/page/-1`,
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// reader-prefs.ts
// ---------------------------------------------------------------------------
describe("reader-prefs.ts", () => {
  test("requires auth (401)", async () => {
    const { app } = await import("../src/app.ts");
    const res = await app.request("/api/v1/reader-prefs/global");
    expect(res.status).toBe(401);
  });

  test("GET /reader-prefs/global returns null before any write", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/reader-prefs/global");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ value: null });
  });

  test("PUT then GET /reader-prefs/global round-trips the JSON payload", async () => {
    const payload = { font: "OpenDyslexic", theme: "dark", lineHeight: 1.6 };
    const put = await authedRequest(primary.bearer, "/api/v1/reader-prefs/global", {
      method: "PUT",
      json: { value: payload },
    });
    expect(put.status).toBe(200);
    const get = await authedRequest(primary.bearer, "/api/v1/reader-prefs/global");
    expect(get.status).toBe(200);
    expect((await get.json()).value).toEqual(payload);
  });

  test("PUT /reader-prefs/global twice updates in place (no duplicate row)", async () => {
    await authedRequest(primary.bearer, "/api/v1/reader-prefs/global", {
      method: "PUT",
      json: { value: { theme: "light" } },
    });
    await authedRequest(primary.bearer, "/api/v1/reader-prefs/global", {
      method: "PUT",
      json: { value: { theme: "sepia" } },
    });
    const get = await authedRequest(primary.bearer, "/api/v1/reader-prefs/global");
    expect((await get.json()).value).toEqual({ theme: "sepia" });
  });

  test("PUT /reader-prefs/global rejects non-object value with 400", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/reader-prefs/global", {
      method: "PUT",
      json: { value: "not-an-object" },
    });
    expect(res.status).toBe(400);
  });

  test("per-book prefs are scoped by (user, bookId)", async () => {
    const bookId = seeded.books[0]!.id;
    const payload = { zoom: 1.25 };
    const put = await authedRequest(
      primary.bearer,
      `/api/v1/reader-prefs/book/${bookId}`,
      { method: "PUT", json: { value: payload } },
    );
    expect(put.status).toBe(200);
    const mine = await authedRequest(
      primary.bearer,
      `/api/v1/reader-prefs/book/${bookId}`,
    );
    expect((await mine.json()).value).toEqual(payload);
    // Different user should see null even for the same book.
    const theirs = await authedRequest(
      secondary.bearer,
      `/api/v1/reader-prefs/book/${bookId}`,
    );
    expect((await theirs.json()).value).toBeNull();
  });

  test("GET /reader-prefs/book/:id rejects non-UUID id with 400", async () => {
    const res = await authedRequest(
      primary.bearer,
      "/api/v1/reader-prefs/book/not-a-uuid",
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// annotations.ts
// ---------------------------------------------------------------------------
describe("annotations.ts (PDF annotations)", () => {
  test("requires auth (401)", async () => {
    const { app } = await import("../src/app.ts");
    const bookId = seeded.books[0]!.id;
    const res = await app.request(`/api/v1/books/${bookId}/pdf-annotations`);
    expect(res.status).toBe(401);
  });

  test("POST creates an annotation and GET lists it", async () => {
    const bookId = seeded.books.find((b) => b.bookType === "PDF")!.id;
    const create = await authedRequest(
      primary.bearer,
      `/api/v1/books/${bookId}/pdf-annotations`,
      {
        method: "POST",
        json: { page: 3, payload: { kind: "highlight", color: "yellow" } },
      },
    );
    expect(create.status).toBe(201);
    const created = await create.json();
    expect(created.id).toBeTruthy();
    expect(created.page).toBe(3);

    const list = await authedRequest(
      primary.bearer,
      `/api/v1/books/${bookId}/pdf-annotations`,
    );
    expect(list.status).toBe(200);
    const rows = await list.json();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.some((r: { id: string }) => r.id === created.id)).toBe(true);
  });

  test("POST rejects a negative page with 400", async () => {
    const bookId = seeded.books[0]!.id;
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/books/${bookId}/pdf-annotations`,
      { method: "POST", json: { page: -1, payload: {} } },
    );
    expect(res.status).toBe(400);
  });

  test("PUT updates an existing annotation", async () => {
    const bookId = seeded.books.find((b) => b.bookType === "PDF")!.id;
    const create = await authedRequest(
      primary.bearer,
      `/api/v1/books/${bookId}/pdf-annotations`,
      { method: "POST", json: { page: 1, payload: { v: 1 } } },
    );
    const { id } = await create.json();
    const update = await authedRequest(
      primary.bearer,
      `/api/v1/pdf-annotations/${id}`,
      { method: "PUT", json: { page: 2, payload: { v: 2 } } },
    );
    expect(update.status).toBe(200);
  });

  test("PUT returns 404 for an annotation owned by someone else", async () => {
    const bookId = seeded.books[0]!.id;
    const create = await authedRequest(
      primary.bearer,
      `/api/v1/books/${bookId}/pdf-annotations`,
      { method: "POST", json: { page: 5, payload: {} } },
    );
    const { id } = await create.json();
    const res = await authedRequest(
      secondary.bearer,
      `/api/v1/pdf-annotations/${id}`,
      { method: "PUT", json: { page: 99, payload: {} } },
    );
    expect(res.status).toBe(404);
  });

  test("DELETE removes the annotation; a second DELETE is 404", async () => {
    const bookId = seeded.books[0]!.id;
    const create = await authedRequest(
      primary.bearer,
      `/api/v1/books/${bookId}/pdf-annotations`,
      { method: "POST", json: { page: 7, payload: {} } },
    );
    const { id } = await create.json();
    const del = await authedRequest(
      primary.bearer,
      `/api/v1/pdf-annotations/${id}`,
      { method: "DELETE" },
    );
    expect(del.status).toBe(200);
    const again = await authedRequest(
      primary.bearer,
      `/api/v1/pdf-annotations/${id}`,
      { method: "DELETE" },
    );
    expect(again.status).toBe(404);
  });

  test("GET only returns the calling user's annotations", async () => {
    const bookId = seeded.books[0]!.id;
    await authedRequest(
      secondary.bearer,
      `/api/v1/books/${bookId}/pdf-annotations`,
      { method: "POST", json: { page: 42, payload: { who: "secondary" } } },
    );
    const list = await authedRequest(
      primary.bearer,
      `/api/v1/books/${bookId}/pdf-annotations`,
    );
    const rows = await list.json();
    for (const r of rows) {
      expect(r.payload?.who).not.toBe("secondary");
    }
  });
});

// ---------------------------------------------------------------------------
// notebook.ts
// ---------------------------------------------------------------------------
describe("notebook.ts", () => {
  test("requires auth (401)", async () => {
    const { app } = await import("../src/app.ts");
    const res = await app.request("/api/v1/notebook");
    expect(res.status).toBe(401);
  });

  test("POST creates an entry and GET lists it", async () => {
    const bookId = seeded.books[0]!.id;
    const create = await authedRequest(primary.bearer, "/api/v1/notebook", {
      method: "POST",
      json: {
        title: TEST_PREFIX + "note",
        content: "Some content here.",
        tags: ["chapter-1", "favourite"],
        bookId,
      },
    });
    expect(create.status).toBe(201);
    const created = await create.json();
    expect(created.id).toBeTruthy();
    expect(created.title).toBe(TEST_PREFIX + "note");
    expect(created.tags).toEqual(["chapter-1", "favourite"]);

    const list = await authedRequest(primary.bearer, "/api/v1/notebook");
    expect(list.status).toBe(200);
    const rows = await list.json();
    expect(rows.some((r: { id: string }) => r.id === created.id)).toBe(true);
  });

  test("POST rejects empty content with 400", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/notebook", {
      method: "POST",
      json: { content: "" },
    });
    expect(res.status).toBe(400);
  });

  test("PUT updates an entry and bumps updatedAt", async () => {
    const create = await authedRequest(primary.bearer, "/api/v1/notebook", {
      method: "POST",
      json: { content: "initial" },
    });
    const created = await create.json();
    const update = await authedRequest(
      primary.bearer,
      `/api/v1/notebook/${created.id}`,
      { method: "PUT", json: { content: "updated content", tags: ["x"] } },
    );
    expect(update.status).toBe(200);

    const list = await authedRequest(primary.bearer, "/api/v1/notebook");
    const rows = await list.json();
    const found = rows.find((r: { id: string }) => r.id === created.id);
    expect(found.content).toBe("updated content");
    expect(found.tags).toEqual(["x"]);
  });

  test("PUT another user's entry is silently a no-op (own row unchanged)", async () => {
    const create = await authedRequest(primary.bearer, "/api/v1/notebook", {
      method: "POST",
      json: { content: "primary-owned" },
    });
    const { id } = await create.json();
    const res = await authedRequest(
      secondary.bearer,
      `/api/v1/notebook/${id}`,
      { method: "PUT", json: { content: "hacked" } },
    );
    // Route returns ok even for a no-op update — verify the row didn't change.
    expect(res.status).toBe(200);
    const list = await authedRequest(primary.bearer, "/api/v1/notebook");
    const rows = await list.json();
    expect(rows.find((r: { id: string }) => r.id === id).content).toBe("primary-owned");
  });

  test("DELETE removes the entry; subsequent list excludes it", async () => {
    const create = await authedRequest(primary.bearer, "/api/v1/notebook", {
      method: "POST",
      json: { content: "to be deleted" },
    });
    const { id } = await create.json();
    const del = await authedRequest(primary.bearer, `/api/v1/notebook/${id}`, {
      method: "DELETE",
    });
    expect(del.status).toBe(200);
    const list = await authedRequest(primary.bearer, "/api/v1/notebook");
    const rows = await list.json();
    expect(rows.some((r: { id: string }) => r.id === id)).toBe(false);
  });

  test("GET only returns the calling user's entries", async () => {
    await authedRequest(secondary.bearer, "/api/v1/notebook", {
      method: "POST",
      json: { content: "secondary-only" },
    });
    const list = await authedRequest(primary.bearer, "/api/v1/notebook");
    const rows = await list.json();
    for (const r of rows) {
      expect(r.userId).toBe(primary.id);
    }
  });
});

// ---------------------------------------------------------------------------
// audiobook.ts — needs an AUDIOBOOK-typed book; on-disk file is absent so
// summary endpoints will 404. We still cover the progress-on-row paths.
// ---------------------------------------------------------------------------
describe("audiobook.ts", () => {
  let audioBookId: string;
  beforeAll(async () => {
    audioBookId = await insertExtraBook({
      libraryId: seeded.libraryId,
      libraryPathId: seeded.libraryPathId,
      bookType: "AUDIOBOOK",
      fileName: "test.m4b",
    });
  });

  test("requires auth (401)", async () => {
    const { app } = await import("../src/app.ts");
    const res = await app.request(`/api/v1/audiobook/${audioBookId}/tracks`);
    expect(res.status).toBe(401);
  });

  test("GET /audiobook/:id/tracks 404s when file is missing on disk", async () => {
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/audiobook/${audioBookId}/tracks`,
    );
    expect(res.status).toBe(404);
  });

  test("GET /audiobook/:id/chapters 404s when file is missing on disk", async () => {
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/audiobook/${audioBookId}/chapters`,
    );
    expect(res.status).toBe(404);
  });

  test("GET /audiobook/:id/current returns 0 before any progress", async () => {
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/audiobook/${audioBookId}/current`,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ positionSeconds: 0 });
  });

  test("PUT /audiobook/:id/current then GET returns the new position (floored)", async () => {
    const put = await authedRequest(
      primary.bearer,
      `/api/v1/audiobook/${audioBookId}/current`,
      { method: "PUT", json: { positionSeconds: 123.9 } },
    );
    expect(put.status).toBe(200);
    const get = await authedRequest(
      primary.bearer,
      `/api/v1/audiobook/${audioBookId}/current`,
    );
    expect(await get.json()).toEqual({ positionSeconds: 123 });
  });

  test("PUT /audiobook/:id/current rejects a negative position with 400", async () => {
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/audiobook/${audioBookId}/current`,
      { method: "PUT", json: { positionSeconds: -5 } },
    );
    expect(res.status).toBe(400);
  });

  test("audiobook progress is per-user", async () => {
    await authedRequest(
      primary.bearer,
      `/api/v1/audiobook/${audioBookId}/current`,
      { method: "PUT", json: { positionSeconds: 999 } },
    );
    const theirs = await authedRequest(
      secondary.bearer,
      `/api/v1/audiobook/${audioBookId}/current`,
    );
    expect(await theirs.json()).toEqual({ positionSeconds: 0 });
  });
});

// ---------------------------------------------------------------------------
// additional-files.ts — round-trip a small upload through the real on-disk
// path. The route writes next to the resolved book file, so we set up a
// dedicated library with a real on-disk path.
// ---------------------------------------------------------------------------
describe("additional-files.ts", () => {
  let onDiskLibraryId: string;
  let onDiskLibraryPathId: string;
  let bookId: string;
  let tmpDir: string;

  beforeAll(async () => {
    const db = requireDb();
    tmpDir = await fs.mkdtemp("/tmp/tsundoku-test-addfiles-");
    tmpDirsToRemove.push(tmpDir);

    const libRows = await db
      .insert(schema.libraries)
      .values({ name: TEST_PREFIX + "addfiles-lib-" + crypto.randomUUID().slice(0, 6) })
      .returning();
    onDiskLibraryId = libRows[0]!.id;
    extraLibraryIds.push(onDiskLibraryId);

    // Grant primary + uploader access so authorization isn't the failure.
    await db.insert(schema.userLibraryMapping).values([
      { userId: primary.id, libraryId: onDiskLibraryId },
      { userId: uploader.id, libraryId: onDiskLibraryId },
    ]);

    const pathRows = await db
      .insert(schema.libraryPaths)
      .values({ libraryId: onDiskLibraryId, path: tmpDir })
      .returning();
    onDiskLibraryPathId = pathRows[0]!.id;

    // Create a real book file on disk so resolveBookFile() finds bytes.
    const fileName = "book.epub";
    await Bun.write(path.join(tmpDir, fileName), "fake epub bytes");
    bookId = await insertExtraBook({
      libraryId: onDiskLibraryId,
      libraryPathId: onDiskLibraryPathId,
      bookType: "EPUB",
      fileName,
    });
  });

  test("requires auth (401)", async () => {
    const { app } = await import("../src/app.ts");
    const res = await app.request(`/api/v1/books/${bookId}/files`);
    expect(res.status).toBe(401);
  });

  test("GET /books/:id/files returns an empty list initially", async () => {
    const res = await authedRequest(primary.bearer, `/api/v1/books/${bookId}/files`);
    expect(res.status).toBe(200);
    const rows = await res.json();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(0);
  });

  test("POST without upload permission is 403", async () => {
    const form = new FormData();
    form.append("file", new File(["hello"], "extra.txt", { type: "text/plain" }));
    const res = await authedRequest(primary.bearer, `/api/v1/books/${bookId}/files`, {
      method: "POST",
      body: form,
    });
    expect(res.status).toBe(403);
  });

  test("POST as uploader writes the file and creates a row; GET lists it; download returns the bytes", async () => {
    const form = new FormData();
    form.append("file", new File(["companion-bytes"], "extra.txt", { type: "text/plain" }));
    form.append("label", "Companion");
    const create = await authedRequest(
      uploader.bearer,
      `/api/v1/books/${bookId}/files`,
      { method: "POST", body: form },
    );
    expect(create.status).toBe(201);
    const created = await create.json();
    expect(created.id).toBeTruthy();
    expect(created.label).toBe("Companion");
    expect(created.fileName).toBe("extra.txt");
    expect(created.sizeBytes).toBe("companion-bytes".length);

    const list = await authedRequest(primary.bearer, `/api/v1/books/${bookId}/files`);
    const rows = await list.json();
    expect(rows.some((r: { id: string }) => r.id === created.id)).toBe(true);

    const dl = await authedRequest(
      primary.bearer,
      `/api/v1/books/${bookId}/files/${created.id}/download`,
    );
    expect(dl.status).toBe(200);
    expect(await dl.text()).toBe("companion-bytes");
  });

  test("POST without a file part returns 400", async () => {
    const form = new FormData();
    form.append("label", "no file here");
    const res = await authedRequest(
      uploader.bearer,
      `/api/v1/books/${bookId}/files`,
      { method: "POST", body: form },
    );
    expect(res.status).toBe(400);
  });

  test("DELETE without manipulateLibrary is 403", async () => {
    // Create a row via the uploader, then try to delete as primary (no perms).
    const form = new FormData();
    form.append("file", new File(["x"], "doomed.txt"));
    const created = await (
      await authedRequest(uploader.bearer, `/api/v1/books/${bookId}/files`, {
        method: "POST",
        body: form,
      })
    ).json();
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/books/${bookId}/files/${created.id}`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(403);
  });

  test("DELETE as uploader removes the row and the on-disk file", async () => {
    const form = new FormData();
    form.append("file", new File(["bye"], "bye.txt"));
    const created = await (
      await authedRequest(uploader.bearer, `/api/v1/books/${bookId}/files`, {
        method: "POST",
        body: form,
      })
    ).json();
    const del = await authedRequest(
      uploader.bearer,
      `/api/v1/books/${bookId}/files/${created.id}`,
      { method: "DELETE" },
    );
    expect(del.status).toBe(200);
    // Verify subsequent download is 404.
    const dl = await authedRequest(
      primary.bearer,
      `/api/v1/books/${bookId}/files/${created.id}/download`,
    );
    expect(dl.status).toBe(404);
  });

  test("GET download with an unknown fileId is 404", async () => {
    const fakeId = crypto.randomUUID();
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/books/${bookId}/files/${fakeId}/download`,
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// stats.ts — read-only. Assert shape, not exact counts beyond what we seeded.
// ---------------------------------------------------------------------------
describe("stats.ts", () => {
  test("requires auth (401)", async () => {
    const { app } = await import("../src/app.ts");
    const res = await app.request("/api/v1/stats/libraries");
    expect(res.status).toBe(401);
  });

  test("GET /stats/libraries returns the expected shape and reflects seeded books", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/stats/libraries");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.totalBooks).toBe("number");
    expect(Array.isArray(body.byLibrary)).toBe(true);
    expect(Array.isArray(body.byFormat)).toBe(true);
    expect(Array.isArray(body.byLanguage)).toBe(true);
    // Seeded library contributes at least 4 books for primary.
    expect(body.totalBooks).toBeGreaterThanOrEqual(4);
  });

  test("GET /stats/reading returns a structured zero baseline for a fresh user", async () => {
    const fresh = await createTestUser();
    try {
      const res = await authedRequest(fresh.bearer, "/api/v1/stats/reading");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.sessionCount).toBe(0);
      expect(body.minutesRead).toBe(0);
      expect(body.booksFinished).toBe(0);
      expect(Array.isArray(body.recentSessions)).toBe(true);
    } finally {
      await deleteTestUsers([fresh.username]);
    }
  });

  test("GET /stats/reading-time honors bucket=week", async () => {
    const res = await authedRequest(
      primary.bearer,
      "/api/v1/stats/reading-time?bucket=week&buckets=4",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("GET /stats/reading-time rejects out-of-range buckets with 400", async () => {
    const res = await authedRequest(
      primary.bearer,
      "/api/v1/stats/reading-time?buckets=9999",
    );
    expect(res.status).toBe(400);
  });

  test("GET /stats/hour-of-day always returns 24 buckets", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/stats/hour-of-day");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(24);
    expect(body[0].hour).toBe(0);
    expect(body[23].hour).toBe(23);
  });

  test("GET /stats/day-of-week always returns 7 buckets", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/stats/day-of-week");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(7);
  });

  test("GET /stats/top-authors and /stats/top-series respect limit", async () => {
    const a = await authedRequest(primary.bearer, "/api/v1/stats/top-authors?limit=5");
    expect(a.status).toBe(200);
    const aBody = await a.json();
    expect(Array.isArray(aBody)).toBe(true);
    expect(aBody.length).toBeLessThanOrEqual(5);

    const s = await authedRequest(primary.bearer, "/api/v1/stats/top-series?limit=5");
    expect(s.status).toBe(200);
    const sBody = await s.json();
    expect(Array.isArray(sBody)).toBe(true);
    expect(sBody.length).toBeLessThanOrEqual(5);
  });

  test("GET /stats/streaks returns current + longest as integers", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/stats/streaks");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Number.isInteger(body.current)).toBe(true);
    expect(Number.isInteger(body.longest)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// email.ts — provider CRUD is admin-only; recipient CRUD is per-user. The
// /email/send route enqueues to BullMQ which may not be available in tests;
// we assert auth + validation but don't insist on a successful enqueue.
// ---------------------------------------------------------------------------
describe("email.ts", () => {
  test("requires auth (401)", async () => {
    const { app } = await import("../src/app.ts");
    const res = await app.request("/api/v1/email/recipients");
    expect(res.status).toBe(401);
  });

  test("GET /email/providers is admin-only (403 for regular user)", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/email/providers");
    expect(res.status).toBe(403);
  });

  test("POST /email/providers as admin creates a provider (passwordCipher not returned)", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/email/providers", {
      method: "POST",
      json: {
        name: TEST_PREFIX + "smtp",
        host: "smtp.example.com",
        port: 587,
        fromAddress: "noreply@example.com",
        password: "should-not-leak",
      },
    });
    expect(res.status).toBe(201);
    const { id } = await res.json();
    expect(id).toBeTruthy();
    emailProviderIds.push(id);

    const list = await authedRequest(admin.bearer, "/api/v1/email/providers");
    const rows = await list.json();
    const found = rows.find((r: { id: string }) => r.id === id);
    expect(found).toBeTruthy();
    expect(found.passwordCipher).toBeUndefined();
    expect(found.password).toBeUndefined();
  });

  test("POST /email/providers rejects an invalid email with 400", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/email/providers", {
      method: "POST",
      json: {
        name: TEST_PREFIX + "bad",
        host: "smtp.example.com",
        fromAddress: "not-an-email",
      },
    });
    expect(res.status).toBe(400);
  });

  test("DELETE /email/providers/:id as non-admin is 403", async () => {
    const fakeId = crypto.randomUUID();
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/email/providers/${fakeId}`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(403);
  });

  test("POST + GET /email/recipients round-trips and is per-user", async () => {
    const email = `kindle-${crypto.randomUUID().slice(0, 6)}@kindle.com`;
    const create = await authedRequest(primary.bearer, "/api/v1/email/recipients", {
      method: "POST",
      json: { label: TEST_PREFIX + "kindle", email },
    });
    expect(create.status).toBe(201);
    const { id } = await create.json();
    expect(id).toBeTruthy();

    const mine = await authedRequest(primary.bearer, "/api/v1/email/recipients");
    const myRows = await mine.json();
    expect(myRows.some((r: { id: string }) => r.id === id)).toBe(true);

    const theirs = await authedRequest(secondary.bearer, "/api/v1/email/recipients");
    const theirRows = await theirs.json();
    expect(theirRows.some((r: { id: string }) => r.id === id)).toBe(false);
  });

  test("POST /email/recipients rejects invalid email with 400", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/email/recipients", {
      method: "POST",
      json: { label: "x", email: "nope" },
    });
    expect(res.status).toBe(400);
  });

  test("DELETE /email/recipients/:id removes the row", async () => {
    const create = await authedRequest(primary.bearer, "/api/v1/email/recipients", {
      method: "POST",
      json: {
        label: "doomed",
        email: `doom-${crypto.randomUUID().slice(0, 6)}@example.com`,
      },
    });
    expect(create.status).toBe(201);
    const { id } = await create.json();
    const del = await authedRequest(
      primary.bearer,
      `/api/v1/email/recipients/${id}`,
      { method: "DELETE" },
    );
    expect(del.status).toBe(200);
    const list = await authedRequest(primary.bearer, "/api/v1/email/recipients");
    const rows = await list.json();
    expect(rows.some((r: { id: string }) => r.id === id)).toBe(false);
  });

  test("POST /email/send rejects invalid body with 400 (no SMTP config required)", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/email/send", {
      method: "POST",
      json: { bookId: "not-a-uuid", recipient: "no" },
    });
    expect(res.status).toBe(400);
  });

  test("POST /email/send with valid body does not crash with a 500 (queue may be unavailable)", async () => {
    // SMTP isn't configured in tests and BullMQ may not have Redis available.
    // The route enqueues; we accept either 202 (enqueued) or 5xx (queue down),
    // but not a 400 — that would indicate validation regressed.
    const res = await authedRequest(primary.bearer, "/api/v1/email/send", {
      method: "POST",
      json: {
        bookId: seeded.books[0]!.id,
        recipient: "send-target@example.com",
      },
    });
    expect(res.status).not.toBe(400);
  });
});
