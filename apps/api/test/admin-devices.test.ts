import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { inArray } from "drizzle-orm";
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

// Suite-scoped fixtures: one admin, one regular user, a seeded library so
// OPDS / admin library-access endpoints have something concrete to verify
// against. Any extra users created mid-test are tracked and torn down in
// afterAll.
let admin: TestUser;
let user: TestUser;
let seeded: SeedResult;
const extraUsernames: string[] = [];
const extraLibraryIds: string[] = [];
const createdAppSettings: Array<{ category: string; name: string }> = [];

// Plain-password fixtures for HTTP Basic / KOReader header auth. createTestUser
// only returns a bearer; the raw password is fixed in helpers.ts.
const PLAIN_PASSWORD = "test-password-12345";

function basicAuth(username: string, password: string): string {
  return "Basic " + btoa(`${username}:${password}`);
}

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  user = await createTestUser();
  seeded = await seedLibraryAndBooks(user.id);
});

afterAll(async () => {
  await deleteLibraries([seeded.libraryId, ...extraLibraryIds]);
  await deleteAuthors(seeded.authorIds);
  await deleteTestUsers([admin.username, user.username, ...extraUsernames]);
  // Best-effort cleanup of any app_settings rows the tests inserted.
  if (createdAppSettings.length) {
    const db = requireDb();
    const names = createdAppSettings.map((s) => s.name);
    await db
      .delete(schema.appSettings)
      .where(inArray(schema.appSettings.name, names));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/* — user management
// ─────────────────────────────────────────────────────────────────────────────

// NB: admin routes are mounted at /api/v1 (not /api/v1/admin) — endpoints are
// /api/v1/users, /api/v1/app-settings, etc. The /admin/ namespace exists only
// in the Spring legacy app.

describe("admin: auth gating", () => {
  test("unauthenticated GET /users is 401", async () => {
    const res = await app.request("/api/v1/users");
    expect(res.status).toBe(401);
  });

  test("non-admin GET /users is 403", async () => {
    const res = await authedRequest(user.bearer, "/api/v1/users");
    expect(res.status).toBe(403);
  });

  test("non-admin POST /users is 403 (rejected before validation)", async () => {
    const res = await authedRequest(user.bearer, "/api/v1/users", {
      method: "POST",
      json: {
        username: TEST_PREFIX + "blocked-" + crypto.randomUUID().slice(0, 4),
        password: "another-test-password",
      },
    });
    expect(res.status).toBe(403);
  });

  test("non-admin GET /app-settings is 403", async () => {
    const res = await authedRequest(user.bearer, "/api/v1/app-settings");
    expect(res.status).toBe(403);
  });

  test("non-admin GET /audit-log is 403", async () => {
    const res = await authedRequest(user.bearer, "/api/v1/audit-log");
    expect(res.status).toBe(403);
  });

  test("non-admin GET /oidc-config is 403", async () => {
    const res = await authedRequest(user.bearer, "/api/v1/oidc-config");
    expect(res.status).toBe(403);
  });
});

describe("admin: users CRUD", () => {
  test("GET /users includes the seeded admin + user", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/users");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    const usernames = body.map((r: { username: string }) => r.username);
    expect(usernames).toContain(admin.username);
    expect(usernames).toContain(user.username);
    // Each row carries a permissions object — not just a flag.
    const row = body.find((r: { username: string }) => r.username === user.username);
    expect(row.permissions).toBeDefined();
    expect(typeof row.permissions.admin).toBe("boolean");
  });

  test("POST /users creates a user and returns id", async () => {
    const username = TEST_PREFIX + "admincreated-" + crypto.randomUUID().slice(0, 6);
    extraUsernames.push(username);
    const res = await authedRequest(admin.bearer, "/api/v1/users", {
      method: "POST",
      json: { username, password: "fresh-password-987" },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.username).toBe(username);
  });

  test("POST /users with short password is rejected (400)", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/users", {
      method: "POST",
      json: {
        username: TEST_PREFIX + "shortpw-" + crypto.randomUUID().slice(0, 4),
        password: "short",
      },
    });
    expect(res.status).toBe(400);
  });

  test("POST /users with bad email shape is rejected (400)", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/users", {
      method: "POST",
      json: {
        username: TEST_PREFIX + "bademail-" + crypto.randomUUID().slice(0, 4),
        password: "long-enough-password",
        email: "not-an-email",
      },
    });
    expect(res.status).toBe(400);
  });

  test("PUT /users/:id/permissions persists changes", async () => {
    const username = TEST_PREFIX + "perm-" + crypto.randomUUID().slice(0, 6);
    extraUsernames.push(username);
    const created = await authedRequest(admin.bearer, "/api/v1/users", {
      method: "POST",
      json: { username, password: "fresh-password-987" },
    });
    const { id } = await created.json();

    const res = await authedRequest(admin.bearer, `/api/v1/users/${id}/permissions`, {
      method: "PUT",
      json: { upload: true, editMetadata: true },
    });
    expect(res.status).toBe(200);

    const list = await authedRequest(admin.bearer, "/api/v1/users").then((r) => r.json());
    const row = list.find((r: { username: string }) => r.username === username);
    expect(row.permissions.upload).toBe(true);
    expect(row.permissions.editMetadata).toBe(true);
  });

  test("PUT /users/:id/permissions with non-uuid id is 400", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/users/not-a-uuid/permissions", {
      method: "PUT",
      json: { upload: true },
    });
    expect(res.status).toBe(400);
  });

  test("PUT /users/:id/password rotates the credential", async () => {
    const username = TEST_PREFIX + "pwrot-" + crypto.randomUUID().slice(0, 6);
    extraUsernames.push(username);
    const created = await authedRequest(admin.bearer, "/api/v1/users", {
      method: "POST",
      json: { username, password: "original-password-1" },
    });
    const { id } = await created.json();
    const res = await authedRequest(admin.bearer, `/api/v1/users/${id}/password`, {
      method: "PUT",
      json: { password: "rotated-password-2" },
    });
    expect(res.status).toBe(200);
  });

  test("POST /users/:id/revoke-sessions is 200 for a valid user", async () => {
    const list = await authedRequest(admin.bearer, "/api/v1/users").then((r) => r.json());
    const target = list.find((u: { username: string }) => u.username === user.username);
    const res = await authedRequest(
      admin.bearer,
      `/api/v1/users/${target.id}/revoke-sessions`,
      { method: "POST" },
    );
    expect(res.status).toBe(200);
  });

  test("DELETE /users/:id removes the user", async () => {
    const username = TEST_PREFIX + "doomed-" + crypto.randomUUID().slice(0, 6);
    // No need to add to extraUsernames — the delete happens here.
    const created = await authedRequest(admin.bearer, "/api/v1/users", {
      method: "POST",
      json: { username, password: "fresh-password-987" },
    });
    const { id } = await created.json();
    const del = await authedRequest(admin.bearer, `/api/v1/users/${id}`, {
      method: "DELETE",
    });
    expect(del.status).toBe(200);

    const list = await authedRequest(admin.bearer, "/api/v1/users").then((r) => r.json());
    const stillThere = list.find((u: { username: string }) => u.username === username);
    expect(stillThere).toBeUndefined();
  });
});

describe("admin: user library access", () => {
  test("GET /users/:id/libraries returns the seeded library", async () => {
    const res = await authedRequest(admin.bearer, `/api/v1/users/${user.id}/libraries`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.libraryIds).toContain(seeded.libraryId);
  });

  test("PUT /users/:id/libraries replaces access set", async () => {
    // Set to empty, verify, then restore to the seeded one so other tests
    // (OPDS, in particular) keep working.
    const empty = await authedRequest(admin.bearer, `/api/v1/users/${user.id}/libraries`, {
      method: "PUT",
      json: { libraryIds: [] },
    });
    expect(empty.status).toBe(200);

    const after = await authedRequest(
      admin.bearer,
      `/api/v1/users/${user.id}/libraries`,
    ).then((r) => r.json());
    expect(after.libraryIds).toEqual([]);

    const restore = await authedRequest(admin.bearer, `/api/v1/users/${user.id}/libraries`, {
      method: "PUT",
      json: { libraryIds: [seeded.libraryId] },
    });
    expect(restore.status).toBe(200);
  });
});

describe("admin: user content restriction", () => {
  test("GET /users/:id/restriction defaults to null", async () => {
    const username = TEST_PREFIX + "restr-" + crypto.randomUUID().slice(0, 6);
    extraUsernames.push(username);
    const created = await authedRequest(admin.bearer, "/api/v1/users", {
      method: "POST",
      json: { username, password: "fresh-password-987" },
    });
    const { id } = await created.json();
    const res = await authedRequest(admin.bearer, `/api/v1/users/${id}/restriction`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.maxAgeRating).toBeNull();
  });

  test("PUT /users/:id/restriction round-trips", async () => {
    const username = TEST_PREFIX + "restr2-" + crypto.randomUUID().slice(0, 6);
    extraUsernames.push(username);
    const created = await authedRequest(admin.bearer, "/api/v1/users", {
      method: "POST",
      json: { username, password: "fresh-password-987" },
    });
    const { id } = await created.json();
    const put = await authedRequest(admin.bearer, `/api/v1/users/${id}/restriction`, {
      method: "PUT",
      json: { maxAgeRating: "PG-13" },
    });
    expect(put.status).toBe(200);
    const after = await authedRequest(
      admin.bearer,
      `/api/v1/users/${id}/restriction`,
    ).then((r) => r.json());
    expect(after.maxAgeRating).toBe("PG-13");
  });
});

describe("admin: app-settings", () => {
  test("GET /app-settings returns an array", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/app-settings");
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test("PUT /app-settings upserts a typed setting", async () => {
    const name = TEST_PREFIX + "ui_theme_" + crypto.randomUUID().slice(0, 4);
    createdAppSettings.push({ category: "ui", name });
    const res = await authedRequest(admin.bearer, "/api/v1/app-settings", {
      method: "PUT",
      json: { category: "ui", name, val: { theme: "dark" } },
    });
    expect(res.status).toBe(200);

    const list = await authedRequest(
      admin.bearer,
      "/api/v1/app-settings?category=ui",
    ).then((r) => r.json());
    const row = list.find((r: { name: string }) => r.name === name);
    expect(row).toBeDefined();
    expect(row.val).toEqual({ theme: "dark" });
  });

  test("PUT /app-settings rejects empty category (400)", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/app-settings", {
      method: "PUT",
      json: { category: "", name: "x", val: 1 },
    });
    expect(res.status).toBe(400);
  });

  test("GET /app-settings?category=… filters by category", async () => {
    const name = TEST_PREFIX + "filter_" + crypto.randomUUID().slice(0, 4);
    createdAppSettings.push({ category: "filtertest", name });
    await authedRequest(admin.bearer, "/api/v1/app-settings", {
      method: "PUT",
      json: { category: "filtertest", name, val: 1 },
    });

    const res = await authedRequest(
      admin.bearer,
      "/api/v1/app-settings?category=filtertest",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.every((r: { category: string }) => r.category === "filtertest")).toBe(true);
  });
});

describe("admin: oidc-config + audit-log", () => {
  test("GET /oidc-config returns an object", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/oidc-config");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
    expect(body).not.toBeNull();
  });

  test("PUT /oidc-config accepts a partial enabled flag", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/oidc-config", {
      method: "PUT",
      json: { enabled: false },
    });
    expect(res.status).toBe(200);
  });

  test("GET /audit-log returns rows (array)", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/audit-log");
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test("GET /audit-log?limit=N clamps & accepts numeric limit", async () => {
    const res = await authedRequest(admin.bearer, "/api/v1/audit-log?limit=5");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeLessThanOrEqual(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/device-users/* — per-user device tokens
// ─────────────────────────────────────────────────────────────────────────────

describe("device-users", () => {
  test("unauthenticated GET /device-users is 401", async () => {
    const res = await app.request("/api/v1/device-users");
    expect(res.status).toBe(401);
  });

  test("GET /device-users returns []  initially for a fresh user", async () => {
    // Use a brand-new user so list scoping isn't muddied by other tests.
    const fresh = await createTestUser();
    extraUsernames.push(fresh.username);
    const res = await authedRequest(fresh.bearer, "/api/v1/device-users");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("POST /device-users creates a token and returns plain token once", async () => {
    const res = await authedRequest(user.bearer, "/api/v1/device-users", {
      method: "POST",
      json: { deviceType: "koreader", label: TEST_PREFIX + "kindle-" + crypto.randomUUID().slice(0, 4) },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(typeof body.token).toBe("string");
    // 32 bytes hex == 64 chars.
    expect(body.token.length).toBe(64);
  });

  test("POST /device-users with invalid deviceType is 400", async () => {
    const res = await authedRequest(user.bearer, "/api/v1/device-users", {
      method: "POST",
      json: { deviceType: "kindle", label: "x" },
    });
    expect(res.status).toBe(400);
  });

  test("POST /device-users with duplicate (type,label) is 409", async () => {
    const label = TEST_PREFIX + "dup-" + crypto.randomUUID().slice(0, 4);
    const first = await authedRequest(user.bearer, "/api/v1/device-users", {
      method: "POST",
      json: { deviceType: "opds", label },
    });
    expect(first.status).toBe(201);
    const second = await authedRequest(user.bearer, "/api/v1/device-users", {
      method: "POST",
      json: { deviceType: "opds", label },
    });
    expect(second.status).toBe(409);
  });

  test("GET /device-users lists the user's tokens (no plaintext)", async () => {
    const label = TEST_PREFIX + "listme-" + crypto.randomUUID().slice(0, 4);
    await authedRequest(user.bearer, "/api/v1/device-users", {
      method: "POST",
      json: { deviceType: "kobo", label },
    });
    const res = await authedRequest(user.bearer, "/api/v1/device-users");
    expect(res.status).toBe(200);
    const list = await res.json();
    const row = list.find((r: { label: string }) => r.label === label);
    expect(row).toBeDefined();
    expect(row.deviceType).toBe("kobo");
    // Token must not be returned on listing.
    expect("token" in row).toBe(false);
    expect("tokenHash" in row).toBe(false);
  });

  test("DELETE /device-users/:id removes it", async () => {
    const create = await authedRequest(user.bearer, "/api/v1/device-users", {
      method: "POST",
      json: { deviceType: "opds", label: TEST_PREFIX + "delme-" + crypto.randomUUID().slice(0, 4) },
    });
    const { id } = await create.json();
    const del = await authedRequest(user.bearer, `/api/v1/device-users/${id}`, {
      method: "DELETE",
    });
    expect(del.status).toBe(200);

    const list = await authedRequest(user.bearer, "/api/v1/device-users").then((r) => r.json());
    expect(list.find((r: { id: string }) => r.id === id)).toBeUndefined();
  });

  test("DELETE /device-users scopes to the owner (other user can't delete)", async () => {
    const other = await createTestUser();
    extraUsernames.push(other.username);
    const create = await authedRequest(user.bearer, "/api/v1/device-users", {
      method: "POST",
      json: { deviceType: "opds", label: TEST_PREFIX + "owned-" + crypto.randomUUID().slice(0, 4) },
    });
    const { id } = await create.json();

    // Other user issues a delete — service filters by userId so it's a no-op,
    // but the response should still be 200 (service swallows).
    const del = await authedRequest(other.bearer, `/api/v1/device-users/${id}`, {
      method: "DELETE",
    });
    expect(del.status).toBe(200);

    // The owner can still see it.
    const list = await authedRequest(user.bearer, "/api/v1/device-users").then((r) => r.json());
    expect(list.find((r: { id: string }) => r.id === id)).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/koreader/* and /kobo/* — devices.ts
// ─────────────────────────────────────────────────────────────────────────────

describe("devices: KOReader sync", () => {
  test("GET /koreader/users/auth without headers is 401", async () => {
    const res = await app.request("/api/v1/koreader/users/auth");
    expect(res.status).toBe(401);
  });

  test("GET /koreader/users/auth with bad credentials is 401", async () => {
    const res = await app.request("/api/v1/koreader/users/auth", {
      headers: { "X-Auth-User": user.username, "X-Auth-Key": "wrong-password" },
    });
    expect(res.status).toBe(401);
  });

  test("GET /koreader/users/auth with valid creds returns username", async () => {
    const res = await app.request("/api/v1/koreader/users/auth", {
      headers: { "X-Auth-User": user.username, "X-Auth-Key": PLAIN_PASSWORD },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.username).toBe(user.username);
  });

  test("PUT /koreader/syncs/progress without auth is 401", async () => {
    const res = await app.request("/api/v1/koreader/syncs/progress", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        document: "deadbeef",
        progress: "/body/DocFragment[5]/body/p[3]",
        percentage: 0.25,
      }),
    });
    expect(res.status).toBe(401);
  });

  test("PUT /koreader/syncs/progress round-trips via GET", async () => {
    const document = "doc-" + crypto.randomUUID().slice(0, 8);
    const put = await app.request("/api/v1/koreader/syncs/progress", {
      method: "PUT",
      headers: {
        "X-Auth-User": user.username,
        "X-Auth-Key": PLAIN_PASSWORD,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        document,
        progress: "/body/DocFragment[1]/p[1]",
        percentage: 0.42,
      }),
    });
    expect(put.status).toBe(200);

    const get = await app.request(`/api/v1/koreader/syncs/progress/${document}`, {
      headers: { "X-Auth-User": user.username, "X-Auth-Key": PLAIN_PASSWORD },
    });
    expect(get.status).toBe(200);
    const body = await get.json();
    expect(body.document).toBe(document);
    expect(body.percentage).toBe(0.42);
  });

  test("GET /koreader/syncs/progress/:doc with no record is 404", async () => {
    const res = await app.request(
      "/api/v1/koreader/syncs/progress/never-stored-" + crypto.randomUUID(),
      { headers: { "X-Auth-User": user.username, "X-Auth-Key": PLAIN_PASSWORD } },
    );
    expect(res.status).toBe(404);
  });

  test("PUT /koreader/syncs/progress with invalid body is 400", async () => {
    const res = await app.request("/api/v1/koreader/syncs/progress", {
      method: "PUT",
      headers: {
        "X-Auth-User": user.username,
        "X-Auth-Key": PLAIN_PASSWORD,
        "content-type": "application/json",
      },
      body: JSON.stringify({ document: "", progress: "", percentage: 2 }),
    });
    expect(res.status).toBe(400);
  });
});

describe("devices: Kobo stubs", () => {
  // Kobo stubs are unauthenticated probes — the device hits them before any
  // login. We just confirm the shape so devices don't hard-crash.
  test("GET /kobo/v1/initialization returns resources", async () => {
    const res = await app.request("/api/v1/kobo/v1/initialization");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.Resources).toBeDefined();
    expect(body.Resources.api_endpoint).toBe("/api/v1/kobo/v1");
  });

  test("GET /kobo/v1/library/sync returns empty entitlements", async () => {
    const res = await app.request("/api/v1/kobo/v1/library/sync");
    expect(res.status).toBe(200);
    expect((await res.json()).NewEntitlements).toEqual([]);
  });

  test("GET /kobo/v1/library/tags returns []", async () => {
    const res = await app.request("/api/v1/kobo/v1/library/tags");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("GET /kobo/v1/images/:id redirects to /books/:id/cover", async () => {
    const id = crypto.randomUUID();
    const res = await app.request(`/api/v1/kobo/v1/images/${id}`, { redirect: "manual" });
    expect([301, 302]).toContain(res.status);
    expect(res.headers.get("location")).toBe(`/api/v1/books/${id}/cover`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/opds/* — OPDS Atom catalog
// ─────────────────────────────────────────────────────────────────────────────

describe("opds: auth + content-type", () => {
  test("GET /opds without auth is 401 with WWW-Authenticate", async () => {
    const res = await app.request("/api/v1/opds");
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toMatch(/^Basic /i);
  });

  test("GET /opds with a bearer token alone is 401 (basic only)", async () => {
    // OPDS clients can't speak our JWT; the route should ignore bearer creds
    // and demand HTTP Basic. Confirm the route actually requires Basic.
    const res = await app.request("/api/v1/opds", {
      headers: { authorization: `Bearer ${user.bearer}` },
    });
    expect(res.status).toBe(401);
  });

  test("GET /opds with bad basic creds is 401", async () => {
    const res = await app.request("/api/v1/opds", {
      headers: { authorization: basicAuth(user.username, "nope") },
    });
    expect(res.status).toBe(401);
  });

  test("GET /opds returns OPDS-flavored Atom XML on valid basic auth", async () => {
    const res = await app.request("/api/v1/opds", {
      headers: { authorization: basicAuth(user.username, PLAIN_PASSWORD) },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toMatch(
      /application\/atom\+xml;profile=opds-catalog;kind=navigation/i,
    );
    const xml = await res.text();
    expect(xml).toContain("<feed");
    expect(xml).toContain("urn:tsundoku:catalog:root");
    expect(xml).toContain("Recent");
    expect(xml).toContain("Libraries");
    expect(xml).toContain("Authors");
    expect(xml).toContain("Series");
  });
});

describe("opds: catalog feeds", () => {
  const opdsAuth = () => ({ authorization: basicAuth(user.username, PLAIN_PASSWORD) });

  test("GET /opds/recent is acquisition kind and lists seeded books", async () => {
    const res = await app.request("/api/v1/opds/recent", { headers: opdsAuth() });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toMatch(/kind=acquisition/i);
    const xml = await res.text();
    // At least one of the seeded book titles should appear in the feed.
    const found = seeded.books.some((b) => xml.includes(b.title));
    expect(found).toBe(true);
    expect(xml).toContain("<entry");
  });

  test("GET /opds/libraries lists the user's seeded library", async () => {
    const res = await app.request("/api/v1/opds/libraries", { headers: opdsAuth() });
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain(`urn:tsundoku:library:${seeded.libraryId}`);
  });

  test("GET /opds/libraries/:id lists books in that library", async () => {
    const res = await app.request(`/api/v1/opds/libraries/${seeded.libraryId}`, {
      headers: opdsAuth(),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toMatch(/kind=acquisition/i);
    const xml = await res.text();
    for (const b of seeded.books) {
      expect(xml).toContain(b.title);
    }
  });

  test("GET /opds/authors includes the seeded author with bookCount", async () => {
    const res = await app.request("/api/v1/opds/authors", { headers: opdsAuth() });
    expect(res.status).toBe(200);
    const xml = await res.text();
    // The seeded author's name is the full TEST_PREFIX form.
    expect(xml).toContain(seeded.authorNames[0]!);
  });

  test("GET /opds/series returns a feed (may be empty)", async () => {
    const res = await app.request("/api/v1/opds/series", { headers: opdsAuth() });
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<feed");
    expect(xml).toContain("urn:tsundoku:catalog:series");
  });

  test("GET /opds/shelves returns a feed for the authenticated user", async () => {
    const res = await app.request("/api/v1/opds/shelves", { headers: opdsAuth() });
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("urn:tsundoku:catalog:shelves");
  });

  test("GET /opds/in-progress returns an acquisition feed", async () => {
    const res = await app.request("/api/v1/opds/in-progress", { headers: opdsAuth() });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toMatch(/kind=acquisition/i);
    const xml = await res.text();
    expect(xml).toContain("<feed");
  });

  test("GET /opds/search?q=Alpha finds the matching seeded book", async () => {
    const res = await app.request("/api/v1/opds/search?q=Alpha", { headers: opdsAuth() });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toMatch(/kind=acquisition/i);
    const xml = await res.text();
    expect(xml).toContain("Alpha High Rated");
  });

  test("GET /opds/search with no q returns a feed with no entries", async () => {
    const res = await app.request("/api/v1/opds/search", { headers: opdsAuth() });
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<feed");
    // The search title interpolates the query — empty is fine.
    expect(xml).toContain("Search:");
  });
});
