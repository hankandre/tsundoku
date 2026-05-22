import { afterAll, beforeAll, describe, expect, test } from "bun:test";
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
let seeded: SeedResult;

beforeAll(async () => {
  primary = await createTestUser();
  secondary = await createTestUser();
  seeded = await seedLibraryAndBooks(primary.id);
});

afterAll(async () => {
  await deleteLibraries([seeded.libraryId]);
  await deleteAuthors(seeded.authorIds);
  await deleteTestUsers([primary.username, secondary.username]);
});

describe("magic shelves CRUD", () => {
  test("POST creates a shelf with an empty group as the default rule set", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/magic-shelves", {
      method: "POST",
      json: { name: TEST_PREFIX + "default-" + crypto.randomUUID().slice(0, 4) },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.rules).toEqual({ type: "group", join: "and", rules: [] });
    expect(body.isPublic).toBe(false);
    // Empty rules match every book in the seeded library.
    expect(body.bookCount).toBe(seeded.books.length);
  });

  test("POST rejects invalid field with 400", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/magic-shelves", {
      method: "POST",
      json: {
        name: TEST_PREFIX + "bad-" + crypto.randomUUID().slice(0, 4),
        rules: {
          type: "group",
          join: "and",
          rules: [
            { type: "rule", field: "definitelyNotAField", operator: "equals", value: "x" },
          ],
        },
      },
    });
    expect(res.status).toBe(400);
  });

  test("POST rejects duplicate (user, name) pair", async () => {
    const name = TEST_PREFIX + "dup-" + crypto.randomUUID().slice(0, 4);
    const first = await authedRequest(primary.bearer, "/api/v1/magic-shelves", {
      method: "POST",
      json: { name },
    });
    expect(first.status).toBe(201);
    const second = await authedRequest(primary.bearer, "/api/v1/magic-shelves", {
      method: "POST",
      json: { name },
    });
    expect(second.status).toBeGreaterThanOrEqual(400);
  });

  test("GET list returns the user's shelves with bookCount", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/magic-shelves");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    for (const shelf of body) {
      expect(shelf.userId).toBe(primary.id);
      expect(typeof shelf.bookCount).toBe("number");
    }
  });

  test("PUT updates rules in place", async () => {
    const create = await authedRequest(primary.bearer, "/api/v1/magic-shelves", {
      method: "POST",
      json: { name: TEST_PREFIX + "putee-" + crypto.randomUUID().slice(0, 4) },
    });
    const id = (await create.json()).id;
    const update = await authedRequest(primary.bearer, `/api/v1/magic-shelves/${id}`, {
      method: "PUT",
      json: {
        rules: {
          type: "group",
          join: "and",
          rules: [{ type: "rule", field: "rating", operator: "greater_than_equal_to", value: 5 }],
        },
      },
    });
    expect(update.status).toBe(200);
    const updated = await update.json();
    expect(updated.rules.rules[0].value).toBe(5);
    // Only the 5-star book matches.
    expect(updated.bookCount).toBe(1);
  });

  test("DELETE removes the shelf; subsequent GET is 404", async () => {
    const create = await authedRequest(primary.bearer, "/api/v1/magic-shelves", {
      method: "POST",
      json: { name: TEST_PREFIX + "doomed-" + crypto.randomUUID().slice(0, 4) },
    });
    const id = (await create.json()).id;
    const del = await authedRequest(primary.bearer, `/api/v1/magic-shelves/${id}`, {
      method: "DELETE",
    });
    expect(del.status).toBe(200);
    const after = await authedRequest(primary.bearer, `/api/v1/magic-shelves/${id}`);
    expect(after.status).toBe(404);
  });
});

describe("magic shelf rule evaluator", () => {
  async function createShelf(rules: unknown): Promise<string> {
    const res = await authedRequest(primary.bearer, "/api/v1/magic-shelves", {
      method: "POST",
      json: { name: TEST_PREFIX + "eval-" + crypto.randomUUID().slice(0, 6), rules },
    });
    if (res.status !== 201) throw new Error(`shelf create failed: ${res.status} ${await res.text()}`);
    return (await res.json()).id;
  }

  async function fetchBookTitles(shelfId: string): Promise<string[]> {
    const res = await authedRequest(
      primary.bearer,
      `/api/v1/magic-shelves/${shelfId}/books`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    return body.content.map((b: { title: string | null; fileName: string }) => b.title ?? b.fileName).sort();
  }

  test("rating >= 4 matches the two top-rated books", async () => {
    const shelfId = await createShelf({
      type: "group",
      join: "and",
      rules: [{ type: "rule", field: "rating", operator: "greater_than_equal_to", value: 4 }],
    });
    const titles = await fetchBookTitles(shelfId);
    expect(titles).toEqual(["Alpha High Rated", "Beta Mid Rated"]);
  });

  test("title contains 'High' is case-insensitive", async () => {
    const shelfId = await createShelf({
      type: "group",
      join: "and",
      rules: [{ type: "rule", field: "title", operator: "contains", value: "high" }],
    });
    const titles = await fetchBookTitles(shelfId);
    expect(titles).toEqual(["Alpha High Rated"]);
  });

  test("includes_any on authors joins via the mapping table", async () => {
    const shelfId = await createShelf({
      type: "group",
      join: "and",
      rules: [
        {
          type: "rule",
          field: "authors",
          operator: "includes_any",
          value: [seeded.authorNames[0]],
        },
      ],
    });
    const titles = await fetchBookTitles(shelfId);
    // Alice authored Alpha and Beta.
    expect(titles).toEqual(["Alpha High Rated", "Beta Mid Rated"]);
  });

  test("OR group combines predicates", async () => {
    const shelfId = await createShelf({
      type: "group",
      join: "or",
      rules: [
        { type: "rule", field: "title", operator: "starts_with", value: "Alpha" },
        { type: "rule", field: "rating", operator: "less_than", value: 3 },
      ],
    });
    const titles = await fetchBookTitles(shelfId);
    // Alpha (starts_with) + Gamma (rating 2). Delta has rating 0 stored as null, so less_than(3) doesn't pick it up.
    expect(titles).toEqual(["Alpha High Rated", "Gamma Low Rated"]);
  });

  test("empty group matches every book in the user's libraries", async () => {
    const shelfId = await createShelf({ type: "group", join: "and", rules: [] });
    const titles = await fetchBookTitles(shelfId);
    expect(titles.length).toBe(seeded.books.length);
  });
});

describe("magic shelf live preview", () => {
  test("POST /preview returns matches for in-flight rules without persisting", async () => {
    const before = await authedRequest(primary.bearer, "/api/v1/magic-shelves").then((r) => r.json());
    const res = await authedRequest(primary.bearer, "/api/v1/magic-shelves/preview", {
      method: "POST",
      json: {
        rules: {
          type: "group",
          join: "and",
          rules: [{ type: "rule", field: "rating", operator: "greater_than_equal_to", value: 4 }],
        },
        size: 10,
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalElements).toBe(2);
    const titles = body.content.map((b: { title: string | null }) => b.title).sort();
    expect(titles).toEqual(["Alpha High Rated", "Beta Mid Rated"]);

    // No shelf was created as a side effect of previewing.
    const after = await authedRequest(primary.bearer, "/api/v1/magic-shelves").then((r) => r.json());
    expect(after.length).toBe(before.length);
  });

  test("POST /preview rejects an invalid rule shape with 400", async () => {
    const res = await authedRequest(primary.bearer, "/api/v1/magic-shelves/preview", {
      method: "POST",
      json: {
        rules: {
          type: "group",
          join: "and",
          rules: [{ type: "rule", field: "definitelyNotAField", operator: "equals", value: "x" }],
        },
      },
    });
    expect(res.status).toBe(400);
  });
});

describe("magic shelf access control", () => {
  test("another user's shelf is 404 to me", async () => {
    const create = await authedRequest(primary.bearer, "/api/v1/magic-shelves", {
      method: "POST",
      json: { name: TEST_PREFIX + "private-" + crypto.randomUUID().slice(0, 4) },
    });
    const id = (await create.json()).id;

    const res = await authedRequest(secondary.bearer, `/api/v1/magic-shelves/${id}`);
    expect(res.status).toBe(404);
  });

  test("listing as another user does not surface my shelves", async () => {
    const myList = await authedRequest(primary.bearer, "/api/v1/magic-shelves").then((r) => r.json());
    const theirList = await authedRequest(secondary.bearer, "/api/v1/magic-shelves").then((r) => r.json());
    const myIds = new Set(myList.map((s: { id: string }) => s.id));
    for (const shelf of theirList) {
      expect(myIds.has(shelf.id)).toBe(false);
    }
  });

  test("requesting another user's shelf books returns an empty page", async () => {
    const create = await authedRequest(primary.bearer, "/api/v1/magic-shelves", {
      method: "POST",
      json: { name: TEST_PREFIX + "books-" + crypto.randomUUID().slice(0, 4) },
    });
    const id = (await create.json()).id;
    const res = await authedRequest(secondary.bearer, `/api/v1/magic-shelves/${id}/books`);
    // Books endpoint defers to listBooks(magicShelfId=…) which returns an
    // empty page when ownership fails — preferable to leaking 404 vs 403
    // signal about whether the id exists.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalElements).toBe(0);
  });
});
