import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, inArray, like } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../src/db.ts";
import { app } from "../src/app.ts";
import {
  TEST_PREFIX,
  authedRequest,
  createTestUser,
  deleteTestUsers,
  type TestUser,
} from "./helpers.ts";

// auth-access: covers auth.ts, oidc.ts, oidc-groups.ts, public.ts, health.ts.
//
// Integration-only: hit endpoints through `app.request(...)`. The database is
// real Postgres (see apps/api/.env) and the test env has no OIDC configured,
// so OIDC endpoints should report disabled.

let normalUser: TestUser;
let adminUser: TestUser;
let loginUser: TestUser;
const loginPassword = "test-password-12345"; // matches createTestUser default
const createdSettingIds: string[] = [];
const extraUsernames: string[] = [];
const createdMappingIds: string[] = [];

async function jsonRequest(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<Response> {
  const headers = new Headers(init?.headers);
  let body = init?.body;
  if (init?.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  return app.request(path, { ...init, headers, body });
}

beforeAll(async () => {
  normalUser = await createTestUser();
  adminUser = await createTestUser({ isAdmin: true });
  loginUser = await createTestUser();

  const db = requireDb();

  // Two public app_settings rows so public-settings list/get can be asserted
  // against known shape, plus a private row that must not leak.
  const publicSettingName = TEST_PREFIX + "brand-" + crypto.randomUUID().slice(0, 6);
  const publicSubSettingName = TEST_PREFIX + "sub-" + crypto.randomUUID().slice(0, 6);
  const privateSettingName = TEST_PREFIX + "priv-" + crypto.randomUUID().slice(0, 6);

  const inserted = await db
    .insert(schema.appSettings)
    .values([
      { category: "public", name: publicSettingName, val: { brandName: "Tsundoku Test" } },
      { category: "public:branding", name: publicSubSettingName, val: { color: "blue" } },
      { category: "private", name: privateSettingName, val: { secret: "nope" } },
    ])
    .returning({ id: schema.appSettings.id, name: schema.appSettings.name });
  for (const row of inserted) createdSettingIds.push(row.id);

  // Expose names on the suite so tests can re-fetch.
  (globalThis as any).__publicSettingName = publicSettingName;
  (globalThis as any).__publicSubSettingName = publicSubSettingName;
  (globalThis as any).__privateSettingName = privateSettingName;
});

afterAll(async () => {
  const db = requireDb();
  if (createdSettingIds.length) {
    await db
      .delete(schema.appSettings)
      .where(inArray(schema.appSettings.id, createdSettingIds));
  }
  if (createdMappingIds.length) {
    await db
      .delete(schema.oidcGroupMappings)
      .where(inArray(schema.oidcGroupMappings.id, createdMappingIds));
  }
  // Sweep any group mappings whose groupName carries TEST_PREFIX (created in
  // a failing test before the id could be captured).
  await db
    .delete(schema.oidcGroupMappings)
    .where(like(schema.oidcGroupMappings.groupName, `${TEST_PREFIX}%`));

  await deleteTestUsers([
    normalUser.username,
    adminUser.username,
    loginUser.username,
    ...extraUsernames,
  ]);
});

// ---------------------------------------------------------------------------
// health.ts
// ---------------------------------------------------------------------------

describe("health", () => {
  test("GET /api/v1/health returns 200 with status, version, timestamp", async () => {
    const res = await app.request("/api/v1/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.version).toBe("string");
    expect(typeof body.timestamp).toBe("string");
    // ISO 8601 sanity check.
    expect(new Date(body.timestamp).toString()).not.toBe("Invalid Date");
  });

  test("GET /api/v1/health/ready returns 200 ok", async () => {
    const res = await app.request("/api/v1/health/ready");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("GET /api/v1/health/live returns 200 ok", async () => {
    const res = await app.request("/api/v1/health/live");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

// ---------------------------------------------------------------------------
// public.ts — unauthenticated endpoints
// ---------------------------------------------------------------------------

describe("public", () => {
  test("GET /api/v1/version requires no auth and returns version + env", async () => {
    const res = await app.request("/api/v1/version");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.version).toBe("string");
    expect(body.env).toBeTruthy();
  });

  test("GET /api/v1/public-settings returns only public categories, unauthenticated", async () => {
    const res = await app.request("/api/v1/public-settings");
    expect(res.status).toBe(200);
    const rows = await res.json();
    expect(Array.isArray(rows)).toBe(true);
    // Every returned row must have a public-ish category.
    for (const r of rows) {
      expect(r.category === "public" || r.category.startsWith("public:")).toBe(true);
    }
    // Our private seeded row must NOT be present.
    const privateName = (globalThis as any).__privateSettingName as string;
    expect(rows.some((r: { name: string }) => r.name === privateName)).toBe(false);
    // Our public row IS present.
    const publicName = (globalThis as any).__publicSettingName as string;
    expect(rows.some((r: { name: string }) => r.name === publicName)).toBe(true);
  });

  test("GET /api/v1/public-settings/:cat/:name returns the matching row", async () => {
    const name = (globalThis as any).__publicSettingName as string;
    const res = await app.request(`/api/v1/public-settings/public/${name}`);
    expect(res.status).toBe(200);
    const row = await res.json();
    expect(row.category).toBe("public");
    expect(row.name).toBe(name);
    expect(row.val).toEqual({ brandName: "Tsundoku Test" });
  });

  test("GET /api/v1/public-settings/:cat/:name supports public: sub-categories", async () => {
    const name = (globalThis as any).__publicSubSettingName as string;
    const res = await app.request(`/api/v1/public-settings/public:branding/${name}`);
    expect(res.status).toBe(200);
    const row = await res.json();
    expect(row.category).toBe("public:branding");
    expect(row.val).toEqual({ color: "blue" });
  });

  test("GET /api/v1/public-settings on a non-public category is 404", async () => {
    const name = (globalThis as any).__privateSettingName as string;
    const res = await app.request(`/api/v1/public-settings/private/${name}`);
    expect(res.status).toBe(404);
  });

  test("GET /api/v1/public-settings on a missing name is 404", async () => {
    const res = await app.request(
      `/api/v1/public-settings/public/does-not-exist-${crypto.randomUUID()}`,
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// auth.ts
// ---------------------------------------------------------------------------

describe("auth - setup-status", () => {
  test("GET /api/v1/auth/setup-status returns needsSetup boolean", async () => {
    const res = await app.request("/api/v1/auth/setup-status");
    expect(res.status).toBe(200);
    const body = await res.json();
    // Other tests already created users, so needsSetup must be false.
    expect(body).toEqual({ needsSetup: false });
  });
});

describe("auth - setup", () => {
  test("POST /api/v1/auth/setup is 409 once any user exists", async () => {
    const res = await jsonRequest("/api/v1/auth/setup", {
      method: "POST",
      json: {
        username: TEST_PREFIX + "setup-" + crypto.randomUUID().slice(0, 6),
        password: "long-enough-password",
      },
    });
    expect(res.status).toBe(409);
  });

  test("POST /api/v1/auth/setup rejects too-short password with 400", async () => {
    const res = await jsonRequest("/api/v1/auth/setup", {
      method: "POST",
      json: {
        username: TEST_PREFIX + "shortpw-" + crypto.randomUUID().slice(0, 6),
        password: "short", // < 8 chars
      },
    });
    expect(res.status).toBe(400);
  });
});

describe("auth - login", () => {
  test("POST /api/v1/auth/login with valid credentials returns access+refresh tokens", async () => {
    const res = await jsonRequest("/api/v1/auth/login", {
      method: "POST",
      json: { username: loginUser.username, password: loginPassword },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.accessToken).toBe("string");
    expect(typeof body.refreshToken).toBe("string");
    expect(typeof body.expiresIn).toBe("number");
    // Cookie should be set.
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("tsundoku_refresh=");
  });

  test("POST /api/v1/auth/login with wrong password returns 401", async () => {
    const res = await jsonRequest("/api/v1/auth/login", {
      method: "POST",
      json: { username: loginUser.username, password: "definitely-wrong" },
    });
    expect(res.status).toBe(401);
  });

  test("POST /api/v1/auth/login with unknown user returns 401", async () => {
    const res = await jsonRequest("/api/v1/auth/login", {
      method: "POST",
      json: {
        username: TEST_PREFIX + "ghost-" + crypto.randomUUID().slice(0, 6),
        password: "anything-at-all",
      },
    });
    expect(res.status).toBe(401);
  });

  test("POST /api/v1/auth/login missing fields returns 400", async () => {
    const res = await jsonRequest("/api/v1/auth/login", {
      method: "POST",
      json: { username: loginUser.username },
    });
    expect(res.status).toBe(400);
  });
});

describe("auth - me", () => {
  test("GET /api/v1/auth/me without a token is 401", async () => {
    const res = await app.request("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  test("GET /api/v1/auth/me with a garbage bearer is 401", async () => {
    const res = await app.request("/api/v1/auth/me", {
      headers: { authorization: "Bearer not.a.real.jwt" },
    });
    expect(res.status).toBe(401);
  });

  test("GET /api/v1/auth/me with a valid token returns user info", async () => {
    const res = await authedRequest(normalUser.bearer, "/api/v1/auth/me");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(normalUser.id);
    expect(body.username).toBe(normalUser.username);
    expect(body.isAdmin).toBe(false);
  });

  test("GET /api/v1/auth/me reflects admin flag for admin users", async () => {
    const res = await authedRequest(adminUser.bearer, "/api/v1/auth/me");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isAdmin).toBe(true);
  });
});

describe("auth - refresh", () => {
  test("POST /api/v1/auth/refresh with no token in body or cookie is 401", async () => {
    const res = await jsonRequest("/api/v1/auth/refresh", { method: "POST" });
    expect(res.status).toBe(401);
  });

  test("POST /api/v1/auth/refresh with an unknown refresh token is 401", async () => {
    const res = await jsonRequest("/api/v1/auth/refresh", {
      method: "POST",
      json: { refreshToken: "not-stored-in-db.foo.bar" },
    });
    expect(res.status).toBe(401);
  });

  test("POST /api/v1/auth/refresh rotates a freshly-issued refresh token", async () => {
    // Login to obtain a refresh token stored in the DB.
    const login = await jsonRequest("/api/v1/auth/login", {
      method: "POST",
      json: { username: loginUser.username, password: loginPassword },
    });
    expect(login.status).toBe(200);
    const { refreshToken } = await login.json();

    const refreshed = await jsonRequest("/api/v1/auth/refresh", {
      method: "POST",
      json: { refreshToken },
    });
    expect(refreshed.status).toBe(200);
    const body = await refreshed.json();
    expect(typeof body.accessToken).toBe("string");
    expect(typeof body.refreshToken).toBe("string");
    expect(body.refreshToken).not.toBe(refreshToken);

    // The original token must now be revoked: a second refresh with it fails.
    const second = await jsonRequest("/api/v1/auth/refresh", {
      method: "POST",
      json: { refreshToken },
    });
    expect(second.status).toBe(401);
  });

  test("POST /api/v1/auth/refresh rejects an access token (wrong type claim)", async () => {
    // Sign in to get a refresh token, then attempt to refresh using the
    // access token, which has no `type: "refresh"` claim.
    const login = await jsonRequest("/api/v1/auth/login", {
      method: "POST",
      json: { username: loginUser.username, password: loginPassword },
    });
    expect(login.status).toBe(200);
    const { accessToken } = await login.json();

    const res = await jsonRequest("/api/v1/auth/refresh", {
      method: "POST",
      json: { refreshToken: accessToken },
    });
    expect(res.status).toBe(401);
  });
});

describe("auth - logout", () => {
  test("POST /api/v1/auth/logout returns ok even without a cookie", async () => {
    const res = await jsonRequest("/api/v1/auth/logout", { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("POST /api/v1/auth/logout revokes the cookie-bound refresh token", async () => {
    const login = await jsonRequest("/api/v1/auth/login", {
      method: "POST",
      json: { username: loginUser.username, password: loginPassword },
    });
    expect(login.status).toBe(200);
    const { refreshToken } = await login.json();

    const logout = await app.request("/api/v1/auth/logout", {
      method: "POST",
      headers: { cookie: `tsundoku_refresh=${refreshToken}` },
    });
    expect(logout.status).toBe(200);

    // The revoked refresh token can no longer be used.
    const after = await jsonRequest("/api/v1/auth/refresh", {
      method: "POST",
      json: { refreshToken },
    });
    expect(after.status).toBe(401);
  });
});

describe("auth - revoke-all", () => {
  test("POST /api/v1/auth/revoke-all without auth is 401", async () => {
    const res = await jsonRequest("/api/v1/auth/revoke-all", { method: "POST" });
    expect(res.status).toBe(401);
  });

  test("POST /api/v1/auth/revoke-all kills every refresh token for the caller", async () => {
    // Spin up a fresh user to keep the assertion local.
    const u = await createTestUser();
    extraUsernames.push(u.username);

    const login = await jsonRequest("/api/v1/auth/login", {
      method: "POST",
      json: { username: u.username, password: loginPassword },
    });
    expect(login.status).toBe(200);
    const { refreshToken } = await login.json();

    const revoke = await authedRequest(u.bearer, "/api/v1/auth/revoke-all", {
      method: "POST",
    });
    expect(revoke.status).toBe(200);

    const after = await jsonRequest("/api/v1/auth/refresh", {
      method: "POST",
      json: { refreshToken },
    });
    expect(after.status).toBe(401);
  });
});

describe("auth - remote (header-based)", () => {
  test("GET /api/v1/auth/remote is 404 when REMOTE_AUTH_ENABLED is false", async () => {
    // The test env doesn't set REMOTE_AUTH_ENABLED, so the route must report
    // disabled regardless of headers.
    const res = await app.request("/api/v1/auth/remote", {
      headers: { "Remote-User": "anyone" },
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// oidc.ts — no OIDC_ISSUER configured, so endpoints should report disabled.
// ---------------------------------------------------------------------------

describe("oidc - disabled in test env", () => {
  test("GET /api/v1/auth/oidc/status reports enabled:false", async () => {
    const res = await app.request("/api/v1/auth/oidc/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.source).toBe("none");
  });

  test("GET /api/v1/auth/oidc/redirect is 404 when disabled", async () => {
    const res = await app.request("/api/v1/auth/oidc/redirect", { redirect: "manual" });
    expect(res.status).toBe(404);
  });

  test("GET /api/v1/auth/oidc/callback is 404 when disabled", async () => {
    const res = await app.request("/api/v1/auth/oidc/callback?code=x&state=y", {
      redirect: "manual",
    });
    expect(res.status).toBe(404);
  });

  test("POST /api/v1/auth/oidc/backchannel-logout is 404 when disabled", async () => {
    const res = await app.request("/api/v1/auth/oidc/backchannel-logout", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "logout_token=anything",
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// oidc-groups.ts — admin-only CRUD; works regardless of OIDC being enabled.
// ---------------------------------------------------------------------------

describe("oidc-groups - admin only", () => {
  test("GET /api/v1/oidc/group-mappings without auth is 401", async () => {
    const res = await app.request("/api/v1/oidc/group-mappings");
    expect(res.status).toBe(401);
  });

  test("GET /api/v1/oidc/group-mappings as a non-admin is 403", async () => {
    const res = await authedRequest(normalUser.bearer, "/api/v1/oidc/group-mappings");
    expect(res.status).toBe(403);
  });

  test("GET /api/v1/oidc/group-mappings as admin returns an array", async () => {
    const res = await authedRequest(adminUser.bearer, "/api/v1/oidc/group-mappings");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("POST /api/v1/oidc/group-mappings as admin creates a mapping", async () => {
    const groupName = TEST_PREFIX + "grp-" + crypto.randomUUID().slice(0, 6);
    const res = await authedRequest(adminUser.bearer, "/api/v1/oidc/group-mappings", {
      method: "POST",
      json: {
        groupName,
        isAdmin: true,
        permissions: ["upload"],
        libraryIds: [],
      },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.groupName).toBe(groupName);
    expect(body.isAdmin).toBe(true);
    expect(body.permissions).toEqual(["upload"]);
    createdMappingIds.push(body.id);
  });

  test("POST /api/v1/oidc/group-mappings as non-admin is 403", async () => {
    const res = await authedRequest(normalUser.bearer, "/api/v1/oidc/group-mappings", {
      method: "POST",
      json: {
        groupName: TEST_PREFIX + "grp-na-" + crypto.randomUUID().slice(0, 6),
      },
    });
    expect(res.status).toBe(403);
  });

  test("POST /api/v1/oidc/group-mappings with missing groupName is 400", async () => {
    const res = await authedRequest(adminUser.bearer, "/api/v1/oidc/group-mappings", {
      method: "POST",
      json: { isAdmin: false },
    });
    expect(res.status).toBe(400);
  });

  test("PUT /api/v1/oidc/group-mappings/:id updates a mapping", async () => {
    const groupName = TEST_PREFIX + "grp-upd-" + crypto.randomUUID().slice(0, 6);
    const create = await authedRequest(adminUser.bearer, "/api/v1/oidc/group-mappings", {
      method: "POST",
      json: { groupName },
    });
    expect(create.status).toBe(201);
    const id = (await create.json()).id;
    createdMappingIds.push(id);

    const newName = groupName + "-renamed";
    const update = await authedRequest(
      adminUser.bearer,
      `/api/v1/oidc/group-mappings/${id}`,
      {
        method: "PUT",
        json: { groupName: newName, isAdmin: true, permissions: ["download"], libraryIds: [] },
      },
    );
    expect(update.status).toBe(200);
    expect(await update.json()).toEqual({ ok: true });

    // Verify the change took.
    const db = requireDb();
    const rows = await db
      .select()
      .from(schema.oidcGroupMappings)
      .where(eq(schema.oidcGroupMappings.id, id));
    expect(rows[0]?.groupName).toBe(newName);
    expect(rows[0]?.isAdmin).toBe(true);
  });

  test("PUT /api/v1/oidc/group-mappings/:id with an unknown id is 404", async () => {
    const res = await authedRequest(
      adminUser.bearer,
      `/api/v1/oidc/group-mappings/${crypto.randomUUID()}`,
      {
        method: "PUT",
        json: { groupName: TEST_PREFIX + "missing-" + crypto.randomUUID().slice(0, 4) },
      },
    );
    expect(res.status).toBe(404);
  });

  test("PUT /api/v1/oidc/group-mappings/:id with a non-uuid id is 400", async () => {
    const res = await authedRequest(
      adminUser.bearer,
      "/api/v1/oidc/group-mappings/not-a-uuid",
      {
        method: "PUT",
        json: { groupName: TEST_PREFIX + "bad-" + crypto.randomUUID().slice(0, 4) },
      },
    );
    expect(res.status).toBe(400);
  });

  test("DELETE /api/v1/oidc/group-mappings/:id removes a mapping; second DELETE is 404", async () => {
    const groupName = TEST_PREFIX + "grp-del-" + crypto.randomUUID().slice(0, 6);
    const create = await authedRequest(adminUser.bearer, "/api/v1/oidc/group-mappings", {
      method: "POST",
      json: { groupName },
    });
    expect(create.status).toBe(201);
    const id = (await create.json()).id;

    const del = await authedRequest(
      adminUser.bearer,
      `/api/v1/oidc/group-mappings/${id}`,
      { method: "DELETE" },
    );
    expect(del.status).toBe(200);

    const again = await authedRequest(
      adminUser.bearer,
      `/api/v1/oidc/group-mappings/${id}`,
      { method: "DELETE" },
    );
    expect(again.status).toBe(404);
  });
});
