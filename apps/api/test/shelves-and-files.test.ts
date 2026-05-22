import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { eq } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../src/db.ts";
import { issueTokens } from "../src/services/tokens.ts";
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

/**
 * Inline helper — issues a JWT for an existing user with custom permissions
 * flags. The auth middleware reads permissions straight off the JWT, so this
 * is the cheapest way to test `manipulateLibrary`/`upload` gating without
 * having to extend createTestUser.
 */
async function bearerWithPermissions(
  user: TestUser,
  permissions: string[],
  isAdmin = false,
): Promise<string> {
  const { accessToken } = await issueTokens({
    userId: user.id,
    username: user.username,
    isAdmin,
    permissions,
  });
  return accessToken;
}

// On-disk scratch directories used by files-admin rename/move tests. We
// create real files so the underlying fs.rename calls succeed and we can
// assert success-path behavior without mocking.
const scratchRoots: string[] = [];

async function scratchDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `${TEST_PREFIX}fa-`));
  scratchRoots.push(dir);
  return dir;
}

let primary: TestUser;
let secondary: TestUser;
let admin: TestUser;
let seeded: SeedResult;
let secondarySeeded: SeedResult;

// Extra library paths created directly via the DB so move/rename tests have a
// physical target. Tracked separately so we can clean up library rows after.
const extraLibraryIds: string[] = [];

beforeAll(async () => {
  primary = await createTestUser();
  secondary = await createTestUser();
  admin = await createTestUser({ isAdmin: true });
  seeded = await seedLibraryAndBooks(primary.id);
  secondarySeeded = await seedLibraryAndBooks(secondary.id);
});

afterAll(async () => {
  await deleteLibraries([
    seeded.libraryId,
    secondarySeeded.libraryId,
    ...extraLibraryIds,
  ]);
  await deleteAuthors([...seeded.authorIds, ...secondarySeeded.authorIds]);
  await deleteTestUsers([primary.username, secondary.username, admin.username]);
  for (const root of scratchRoots) {
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// shelves.ts — regular (non-magic) shelves
// ---------------------------------------------------------------------------

describe("shelves CRUD", () => {
  test("POST /shelves creates a shelf scoped to the requester", async () => {
    const name = TEST_PREFIX + "shelf-" + crypto.randomUUID().slice(0, 4);
    const res = await authedRequest(primary.bearer, "/api/v1/shelves", {
      method: "POST",
      json: { name },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.userId).toBe(primary.id);
    expect(body.name).toBe(name);
    expect(body.bookCount).toBe(0);
  });

  test("POST /shelves with icon persists icon", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/shelves", {
      method: "POST",
      json: {
        name: TEST_PREFIX + "icon-" + crypto.randomUUID().slice(0, 4),
        icon: "pi-star",
      },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.icon).toBe("pi-star");
  });

  test("POST /shelves rejects empty name with 400", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/shelves", {
      method: "POST",
      json: { name: "" },
    });
    expect(res.status).toBe(400);
  });

  test("POST /shelves rejects oversized name with 400", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/shelves", {
      method: "POST",
      json: { name: "x".repeat(300) },
    });
    expect(res.status).toBe(400);
  });

  test("GET /shelves returns only the requester's shelves", async () => {
    // Make sure primary has at least one shelf and secondary has its own.
    const a = await authedRequest(primary.bearer, "/api/v1/shelves", {
      method: "POST",
      json: { name: TEST_PREFIX + "p-" + crypto.randomUUID().slice(0, 4) },
    });
    expect(a.status).toBe(201);
    const b = await authedRequest(secondary.bearer, "/api/v1/shelves", {
      method: "POST",
      json: { name: TEST_PREFIX + "s-" + crypto.randomUUID().slice(0, 4) },
    });
    expect(b.status).toBe(201);
    const secondaryShelfId = (await b.json()).id;

    const res = await authedRequest(primary.bearer, "/api/v1/shelves");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    for (const shelf of body) {
      expect(shelf.userId).toBe(primary.id);
      expect(shelf.id).not.toBe(secondaryShelfId);
    }
  });

  test("DELETE /shelves/:id removes the shelf", async () => {
    const create = await authedRequest(primary.bearer, "/api/v1/shelves", {
      method: "POST",
      json: { name: TEST_PREFIX + "doomed-" + crypto.randomUUID().slice(0, 4) },
    });
    const id = (await create.json()).id;
    const del = await authedRequest(primary.bearer, `/api/v1/shelves/${id}`, {
      method: "DELETE",
    });
    expect(del.status).toBe(200);

    // After deletion the shelf's books endpoint behaves like "not yours": empty list.
    const after = await authedRequest(primary.bearer, `/api/v1/shelves/${id}/books`);
    expect(after.status).toBe(200);
    expect((await after.json()).bookIds).toEqual([]);
  });

  test("DELETE /shelves/:id by non-owner is a no-op (200), owner's shelf survives", async () => {
    const create = await authedRequest(primary.bearer, "/api/v1/shelves", {
      method: "POST",
      json: { name: TEST_PREFIX + "owned-" + crypto.randomUUID().slice(0, 4) },
    });
    const id = (await create.json()).id;
    const del = await authedRequest(secondary.bearer, `/api/v1/shelves/${id}`, {
      method: "DELETE",
    });
    // deleteShelf scopes by userId — wrong owner becomes a silent no-op.
    expect(del.status).toBe(200);
    // Confirm the shelf still exists by listing primary's shelves.
    const list = await authedRequest(primary.bearer, "/api/v1/shelves").then((r) => r.json());
    expect(list.some((s: { id: string }) => s.id === id)).toBe(true);
  });

  test("DELETE /shelves/:id with non-uuid id returns 400", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/shelves/not-a-uuid", {
      method: "DELETE",
    });
    expect(res.status).toBe(400);
  });

  test("DELETE /shelves/:id with unknown uuid is a no-op (200)", async () => {
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/shelves/${crypto.randomUUID()}`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(200);
  });
});

describe("shelf book assignment", () => {
  async function createPrimaryShelf(label: string): Promise<string> {
    const res = await authedRequest(primary.bearer, "/api/v1/shelves", {
      method: "POST",
      json: { name: TEST_PREFIX + label + "-" + crypto.randomUUID().slice(0, 4) },
    });
    if (res.status !== 201)
      throw new Error(`shelf create failed: ${res.status} ${await res.text()}`);
    return (await res.json()).id;
  }

  test("PUT /shelves/:id/books sets the contents and is reflected in GET", async () => {
    const shelfId = await createPrimaryShelf("set");
    const bookIds = seeded.books.slice(0, 2).map((b) => b.id);
    const put = await authedRequest(
      primary.bearer,
      `/api/v1/shelves/${shelfId}/books`,
      { method: "PUT", json: { bookIds } },
    );
    expect(put.status).toBe(200);

    const list = await authedRequest(
      primary.bearer,
      `/api/v1/shelves/${shelfId}/books`,
    );
    expect(list.status).toBe(200);
    const body = await list.json();
    expect([...body.bookIds].sort()).toEqual([...bookIds].sort());
  });

  test("PUT /shelves/:id/books with empty list clears the shelf", async () => {
    const shelfId = await createPrimaryShelf("clear");
    await authedRequest(primary.bearer, `/api/v1/shelves/${shelfId}/books`, {
      method: "PUT",
      json: { bookIds: [seeded.books[0]!.id] },
    });
    const clear = await authedRequest(
      primary.bearer,
      `/api/v1/shelves/${shelfId}/books`,
      { method: "PUT", json: { bookIds: [] } },
    );
    expect(clear.status).toBe(200);
    const after = await authedRequest(
      primary.bearer,
      `/api/v1/shelves/${shelfId}/books`,
    ).then((r) => r.json());
    expect(after.bookIds).toEqual([]);
  });

  test("PUT /shelves/:id/books bumps bookCount on the listing", async () => {
    const shelfId = await createPrimaryShelf("count");
    await authedRequest(primary.bearer, `/api/v1/shelves/${shelfId}/books`, {
      method: "PUT",
      json: { bookIds: seeded.books.map((b) => b.id) },
    });
    const list = await authedRequest(primary.bearer, "/api/v1/shelves").then((r) =>
      r.json(),
    );
    const me = list.find((s: { id: string }) => s.id === shelfId);
    expect(me).toBeTruthy();
    expect(me.bookCount).toBe(seeded.books.length);
  });

  test("PUT /shelves/:id/books on someone else's shelf fails", async () => {
    // Create as primary, then PUT as secondary.
    const create = await authedRequest(primary.bearer, "/api/v1/shelves", {
      method: "POST",
      json: { name: TEST_PREFIX + "alien-" + crypto.randomUUID().slice(0, 4) },
    });
    const id = (await create.json()).id;
    const res = await authedRequest(secondary.bearer, `/api/v1/shelves/${id}/books`, {
      method: "PUT",
      json: { bookIds: [secondarySeeded.books[0]!.id] },
    });
    // Service throws plain Error → caught by app.onError → 500. We assert
    // "not 2xx" so behavior tightening to 403/404 doesn't break the test.
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("PUT /shelves/:id/books with malformed body rejected with 400", async () => {
    const shelfId = await createPrimaryShelf("bad");
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/shelves/${shelfId}/books`,
      { method: "PUT", json: { bookIds: ["not-a-uuid"] } },
    );
    expect(res.status).toBe(400);
  });

  test("GET /shelves/:id/books on someone else's shelf returns empty bookIds", async () => {
    const create = await authedRequest(primary.bearer, "/api/v1/shelves", {
      method: "POST",
      json: { name: TEST_PREFIX + "peek-" + crypto.randomUUID().slice(0, 4) },
    });
    const id = (await create.json()).id;
    await authedRequest(primary.bearer, `/api/v1/shelves/${id}/books`, {
      method: "PUT",
      json: { bookIds: [seeded.books[0]!.id] },
    });
    const res = await authedRequest(secondary.bearer, `/api/v1/shelves/${id}/books`);
    expect(res.status).toBe(200);
    expect((await res.json()).bookIds).toEqual([]);
  });

  test("PUT /books/:id/shelves places the book on the named shelves", async () => {
    const a = await createPrimaryShelf("ba");
    const b = await createPrimaryShelf("bb");
    const bookId = seeded.books[0]!.id;
    const put = await authedRequest(
      primary.bearer,
      `/api/v1/books/${bookId}/shelves`,
      { method: "PUT", json: { shelfIds: [a, b] } },
    );
    expect(put.status).toBe(200);

    // Verify by reading each shelf's contents back.
    const aList = await authedRequest(
      primary.bearer,
      `/api/v1/shelves/${a}/books`,
    ).then((r) => r.json());
    const bList = await authedRequest(
      primary.bearer,
      `/api/v1/shelves/${b}/books`,
    ).then((r) => r.json());
    expect(aList.bookIds).toContain(bookId);
    expect(bList.bookIds).toContain(bookId);
  });

  test("PUT /books/:id/shelves replaces previous assignments restricted to user's shelves", async () => {
    const a = await createPrimaryShelf("rep-a");
    const b = await createPrimaryShelf("rep-b");
    const bookId = seeded.books[1]!.id;
    await authedRequest(primary.bearer, `/api/v1/books/${bookId}/shelves`, {
      method: "PUT",
      json: { shelfIds: [a] },
    });
    await authedRequest(primary.bearer, `/api/v1/books/${bookId}/shelves`, {
      method: "PUT",
      json: { shelfIds: [b] },
    });
    const aList = await authedRequest(
      primary.bearer,
      `/api/v1/shelves/${a}/books`,
    ).then((r) => r.json());
    const bList = await authedRequest(
      primary.bearer,
      `/api/v1/shelves/${b}/books`,
    ).then((r) => r.json());
    expect(aList.bookIds).not.toContain(bookId);
    expect(bList.bookIds).toContain(bookId);
  });

  test("PUT /books/:id/shelves with empty list clears the book's shelf assignments", async () => {
    const a = await createPrimaryShelf("clr");
    const bookId = seeded.books[2]!.id;
    await authedRequest(primary.bearer, `/api/v1/books/${bookId}/shelves`, {
      method: "PUT",
      json: { shelfIds: [a] },
    });
    const clear = await authedRequest(
      primary.bearer,
      `/api/v1/books/${bookId}/shelves`,
      { method: "PUT", json: { shelfIds: [] } },
    );
    expect(clear.status).toBe(200);
    const aList = await authedRequest(
      primary.bearer,
      `/api/v1/shelves/${a}/books`,
    ).then((r) => r.json());
    expect(aList.bookIds).not.toContain(bookId);
  });

  test("PUT /books/:id/shelves referencing a shelf I don't own fails", async () => {
    // Create the shelf as secondary, then have primary try to assign one of
    // their books to it.
    const create = await authedRequest(secondary.bearer, "/api/v1/shelves", {
      method: "POST",
      json: { name: TEST_PREFIX + "foreign-" + crypto.randomUUID().slice(0, 4) },
    });
    const foreignShelfId = (await create.json()).id;

    const res = await authedRequest(
      primary.bearer,
      `/api/v1/books/${seeded.books[0]!.id}/shelves`,
      { method: "PUT", json: { shelfIds: [foreignShelfId] } },
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe("shelves auth", () => {
  test("GET /shelves without bearer is 401", async () => {
    const res = await app.request("/api/v1/shelves");
    expect(res.status).toBe(401);
  });

  test("POST /shelves without bearer is 401", async () => {
    const res = await app.request("/api/v1/shelves", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: TEST_PREFIX + "anon" }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// files-admin.ts — rename / move book files (admin or manipulateLibrary)
// ---------------------------------------------------------------------------

describe("files-admin rename/move", () => {
  test("PUT /books/:id/rename without manage permission is 403", async () => {
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/books/${seeded.books[0]!.id}/rename`,
      { method: "PUT", json: { newName: "renamed.epub" } },
    );
    expect(res.status).toBe(403);
  });

  test("PUT /books/:id/rename rejects path separators in newName with 400", async () => {
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/books/${seeded.books[0]!.id}/rename`,
      { method: "PUT", json: { newName: "subdir/evil.epub" } },
    );
    expect(res.status).toBe(400);
  });

  test("PUT /books/:id/rename with empty newName is 400", async () => {
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/books/${seeded.books[0]!.id}/rename`,
      { method: "PUT", json: { newName: "" } },
    );
    expect(res.status).toBe(400);
  });

  test("PUT /books/:id/rename for unknown book id is 404", async () => {
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/books/${crypto.randomUUID()}/rename`,
      { method: "PUT", json: { newName: "ok.epub" } },
    );
    expect(res.status).toBe(404);
  });

  test("PUT /books/:id/rename with non-uuid id returns 400", async () => {
    const res = await authedRequest(
      admin.bearer,
      "/api/v1/books/not-a-uuid/rename",
      { method: "PUT", json: { newName: "ok.epub" } },
    );
    expect(res.status).toBe(400);
  });

  test("PUT /books/:id/rename succeeds when admin renames a real file", async () => {
    // Build an isolated library + path on disk with one real file so the
    // rename succeeds end-to-end (DB row + filesystem).
    const db = requireDb();
    const root = await scratchDir();
    const libRows = await db
      .insert(schema.libraries)
      .values({ name: TEST_PREFIX + "rn-" + crypto.randomUUID().slice(0, 6) })
      .returning();
    const libraryId = libRows[0]!.id;
    extraLibraryIds.push(libraryId);
    const pathRows = await db
      .insert(schema.libraryPaths)
      .values({ libraryId, path: root })
      .returning();
    const libraryPathId = pathRows[0]!.id;
    const fileName = "rename-me.epub";
    await fs.writeFile(path.join(root, fileName), "epub-bytes");
    const bookRows = await db
      .insert(schema.books)
      .values({ libraryId, libraryPathId, fileName, bookType: "EPUB" })
      .returning();
    const bookId = bookRows[0]!.id;

    const res = await authedRequest(
      admin.bearer,
      `/api/v1/books/${bookId}/rename`,
      { method: "PUT", json: { newName: "renamed.epub" } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.fileName).toBe("renamed.epub");
    expect(await fs.stat(path.join(root, "renamed.epub")).then(() => true)).toBe(true);
  });

  test("PUT /books/:id/rename returns 409 when destination already exists", async () => {
    const db = requireDb();
    const root = await scratchDir();
    const libRows = await db
      .insert(schema.libraries)
      .values({ name: TEST_PREFIX + "rn-cl-" + crypto.randomUUID().slice(0, 6) })
      .returning();
    const libraryId = libRows[0]!.id;
    extraLibraryIds.push(libraryId);
    const pathRows = await db
      .insert(schema.libraryPaths)
      .values({ libraryId, path: root })
      .returning();
    const libraryPathId = pathRows[0]!.id;
    await fs.writeFile(path.join(root, "a.epub"), "a");
    await fs.writeFile(path.join(root, "b.epub"), "b");
    const bookRows = await db
      .insert(schema.books)
      .values({ libraryId, libraryPathId, fileName: "a.epub", bookType: "EPUB" })
      .returning();
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/books/${bookRows[0]!.id}/rename`,
      { method: "PUT", json: { newName: "b.epub" } },
    );
    expect(res.status).toBe(409);
  });

  test("PUT /books/:id/move without manage permission is 403", async () => {
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/books/${seeded.books[0]!.id}/move`,
      { method: "PUT", json: { libraryPathId: seeded.libraryPathId } },
    );
    expect(res.status).toBe(403);
  });

  test("PUT /books/:id/move with non-uuid libraryPathId is 400", async () => {
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/books/${seeded.books[0]!.id}/move`,
      { method: "PUT", json: { libraryPathId: "not-a-uuid" } },
    );
    expect(res.status).toBe(400);
  });

  test("PUT /books/:id/move with unknown libraryPathId is 400", async () => {
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/books/${seeded.books[0]!.id}/move`,
      { method: "PUT", json: { libraryPathId: crypto.randomUUID() } },
    );
    expect(res.status).toBe(400);
  });

  test("PUT /books/:id/move refuses to cross libraries", async () => {
    // seeded belongs to primary's library; secondarySeeded's libraryPathId is
    // in a different library, so the route should reject it.
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/books/${seeded.books[0]!.id}/move`,
      { method: "PUT", json: { libraryPathId: secondarySeeded.libraryPathId } },
    );
    expect(res.status).toBe(400);
  });

  test("PUT /books/:id/move succeeds with a same-library destination path", async () => {
    const db = requireDb();
    const srcRoot = await scratchDir();
    const dstRoot = await scratchDir();
    const libRows = await db
      .insert(schema.libraries)
      .values({ name: TEST_PREFIX + "mv-" + crypto.randomUUID().slice(0, 6) })
      .returning();
    const libraryId = libRows[0]!.id;
    extraLibraryIds.push(libraryId);
    const [srcPath] = await db
      .insert(schema.libraryPaths)
      .values({ libraryId, path: srcRoot })
      .returning();
    const [dstPath] = await db
      .insert(schema.libraryPaths)
      .values({ libraryId, path: dstRoot })
      .returning();
    const fileName = "movable.epub";
    await fs.writeFile(path.join(srcRoot, fileName), "data");
    const bookRows = await db
      .insert(schema.books)
      .values({
        libraryId,
        libraryPathId: srcPath!.id,
        fileName,
        bookType: "EPUB",
      })
      .returning();
    const bookId = bookRows[0]!.id;

    const res = await authedRequest(admin.bearer, `/api/v1/books/${bookId}/move`, {
      method: "PUT",
      json: { libraryPathId: dstPath!.id },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(await fs.stat(path.join(dstRoot, fileName)).then(() => true)).toBe(true);

    // DB row should have been updated to point at dstPath.
    const after = await db
      .select({ libraryPathId: schema.books.libraryPathId })
      .from(schema.books)
      .where(eq(schema.books.id, bookId));
    expect(after[0]!.libraryPathId).toBe(dstPath!.id);
  });

  test("PUT /books/:id/rename works for a non-admin with manipulateLibrary permission", async () => {
    const db = requireDb();
    const root = await scratchDir();
    const libRows = await db
      .insert(schema.libraries)
      .values({ name: TEST_PREFIX + "rn-perm-" + crypto.randomUUID().slice(0, 6) })
      .returning();
    const libraryId = libRows[0]!.id;
    extraLibraryIds.push(libraryId);
    const [p] = await db
      .insert(schema.libraryPaths)
      .values({ libraryId, path: root })
      .returning();
    const fileName = "perm.epub";
    await fs.writeFile(path.join(root, fileName), "x");
    const [book] = await db
      .insert(schema.books)
      .values({ libraryId, libraryPathId: p!.id, fileName, bookType: "EPUB" })
      .returning();

    const bearer = await bearerWithPermissions(primary, ["manipulateLibrary"]);
    const res = await authedRequest(bearer, `/api/v1/books/${book!.id}/rename`, {
      method: "PUT",
      json: { newName: "perm-renamed.epub" },
    });
    expect(res.status).toBe(200);
  });

  test("PUT /books/:id/rename without auth is 401", async () => {
    const res = await app.request(
      `/api/v1/books/${seeded.books[0]!.id}/rename`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newName: "ok.epub" }),
      },
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// fs.ts — server-side filesystem browser (admin or manipulateLibrary)
// ---------------------------------------------------------------------------

describe("fs browser", () => {
  test("GET /fs/list without auth is 401", async () => {
    const res = await app.request("/api/v1/fs/list");
    expect(res.status).toBe(401);
  });

  test("GET /fs/list without manage permission is 403", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/fs/list");
    expect(res.status).toBe(403);
  });

  test("GET /fs/list as admin returns entries for a known directory", async () => {
    const dir = await scratchDir();
    await fs.mkdir(path.join(dir, "sub-a"));
    await fs.mkdir(path.join(dir, "sub-b"));
    await fs.writeFile(path.join(dir, "ignored.txt"), "not a dir");
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/fs/list?path=${encodeURIComponent(dir)}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.path).toBe(dir);
    const names = body.entries.map((e: { name: string }) => e.name);
    expect(names).toContain("sub-a");
    expect(names).toContain("sub-b");
    // Files are filtered out — only dirs/symlinks are listed.
    expect(names).not.toContain("ignored.txt");
    for (const entry of body.entries) {
      expect(entry.isDir).toBe(true);
    }
  });

  test("GET /fs/list hides dotfiles unless showHidden=true", async () => {
    const dir = await scratchDir();
    await fs.mkdir(path.join(dir, ".hidden"));
    await fs.mkdir(path.join(dir, "visible"));
    const hidden = await authedRequest(
      admin.bearer,
      `/api/v1/fs/list?path=${encodeURIComponent(dir)}`,
    ).then((r) => r.json());
    expect(hidden.entries.map((e: { name: string }) => e.name)).toEqual(["visible"]);

    const shown = await authedRequest(
      admin.bearer,
      `/api/v1/fs/list?path=${encodeURIComponent(dir)}&showHidden=true`,
    ).then((r) => r.json());
    const names = shown.entries.map((e: { name: string }) => e.name).sort();
    expect(names).toEqual([".hidden", "visible"]);
  });

  test("GET /fs/list with showHidden=notabool is 400", async () => {
    const dir = await scratchDir();
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/fs/list?path=${encodeURIComponent(dir)}&showHidden=notabool`,
    );
    expect(res.status).toBe(400);
  });

  test("GET /fs/list returns 404 for a missing path", async () => {
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/fs/list?path=${encodeURIComponent("/nope-" + crypto.randomUUID())}`,
    );
    expect(res.status).toBe(404);
  });

  test("GET /fs/list returns 400 when path is a file rather than a directory", async () => {
    const dir = await scratchDir();
    const filePath = path.join(dir, "regular.txt");
    await fs.writeFile(filePath, "hi");
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/fs/list?path=${encodeURIComponent(filePath)}`,
    );
    expect(res.status).toBe(400);
  });

  test("GET /fs/check reports existence for a real directory", async () => {
    const dir = await scratchDir();
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/fs/check?path=${encodeURIComponent(dir)}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exists).toBe(true);
    expect(body.isDir).toBe(true);
  });

  test("GET /fs/check reports non-existence cleanly (200, exists=false)", async () => {
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/fs/check?path=${encodeURIComponent("/definitely-not-here-" + crypto.randomUUID())}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exists).toBe(false);
    expect(body.isDir).toBe(false);
  });

  test("GET /fs/check without path query is 400", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/fs/check");
    expect(res.status).toBe(400);
  });

  test("GET /fs/check without manage permission is 403", async () => {
    const res = await authedRequest(
      primary.bearer,
      "/api/v1/fs/check?path=/tmp",
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// bookdrop.ts — staged file ingestion
// ---------------------------------------------------------------------------

describe("bookdrop", () => {
  test("GET /bookdrop/files without auth is 401", async () => {
    const res = await app.request("/api/v1/bookdrop/files");
    expect(res.status).toBe(401);
  });

  test("GET /bookdrop/files returns an array (likely empty in test)", async () => {
    // listStagedFiles is in-memory; the watcher isn't started outside of
    // server.ts, so this just asserts shape + status.
    const res = await authedRequest(primary.bearer, "/api/v1/bookdrop/files");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("POST /bookdrop/files/:id/finalize without upload permission is 403", async () => {
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/bookdrop/files/some-staged-id/finalize`,
      { method: "POST", json: { libraryId: seeded.libraryId } },
    );
    expect(res.status).toBe(403);
  });

  test("POST /bookdrop/files/:id/finalize with empty id is 404 (param validator + auth gate)", async () => {
    // The :id param requires `string > 0`, so the trailing slash path would
    // 404 from the router. We use a non-empty id with admin to exercise the
    // service-not-found branch.
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/bookdrop/files/nonexistent-id/finalize`,
      { method: "POST", json: { libraryId: seeded.libraryId } },
    );
    // No watcher in test → no staged files → service returns
    // { error: "Staged file not found" } → 400.
    expect(res.status).toBe(400);
  });

  test("POST /bookdrop/files/:id/finalize rejects invalid libraryId with 400", async () => {
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/bookdrop/files/x/finalize`,
      { method: "POST", json: { libraryId: "not-a-uuid" } },
    );
    expect(res.status).toBe(400);
  });

  test("POST /bookdrop/files/:id/finalize works for non-admin with upload permission (still 400, but past the perm gate)", async () => {
    const bearer = await bearerWithPermissions(primary, ["upload"]);
    const res = await authedRequest(
      bearer,
      `/api/v1/bookdrop/files/some-id/finalize`,
      { method: "POST", json: { libraryId: seeded.libraryId } },
    );
    // Permission check passes → falls through to service which has no staged
    // file → 400 (not 403).
    expect(res.status).toBe(400);
  });

  test("DELETE /bookdrop/files/:id without upload permission is 403", async () => {
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/bookdrop/files/some-id`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(403);
  });

  test("DELETE /bookdrop/files/:id with admin + unknown id is 404", async () => {
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/bookdrop/files/unknown-id`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(404);
  });

  test("DELETE /bookdrop/files/:id rejects invalid query flag with 400", async () => {
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/bookdrop/files/unknown-id?delete=maybe`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(400);
  });
});
