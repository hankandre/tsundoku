import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { authRequired } from "../middleware/auth.ts";
import {
  findByUsername,
  findById,
  verifyPassword,
  createLocalUser,
  createFirstAdminIfEmpty,
  countUsers,
  permissionsToList,
} from "../services/users.ts";
import { issueTokens, verifyToken, TOKEN_TTL } from "../services/tokens.ts";
import {
  storeRefreshToken,
  findActiveRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
} from "../services/refresh-tokens.ts";
import { env } from "../env.ts";
import { logger } from "../logger.ts";

const LoginBody = type({
  username: "1 <= string <= 128",
  password: "1 <= string <= 512",
});

const RefreshBody = type({
  refreshToken: "string > 0",
});

const SetupBody = type({
  username: "1 <= string <= 128",
  password: "8 <= string <= 512",
  "name?": "string <= 256",
  "email?": "string.email <= 256",
});

const REFRESH_COOKIE = "tsundoku_refresh";

function setRefreshCookie(c: Context, token: string) {
  setCookie(c, REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: env.NODE_ENV === "production",
    path: "/api/v1/auth",
    maxAge: TOKEN_TTL.refresh,
  });
}

export const authRoutes = new Hono()
  // First-run check: is the user table empty? Unauthenticated; safe to expose
  // because the answer is "did the operator install this app yet."
  .get("/auth/setup-status", async (c) => {
    const n = await countUsers();
    return c.json({ needsSetup: n === 0 });
  })

  // First-run bootstrap: create the first user as a superuser admin. Atomic;
  // returns 409 if a user already exists.
  .post("/auth/setup", sValidator("json", SetupBody), async (c) => {
    const body = c.req.valid("json");
    const user = await createFirstAdminIfEmpty(body);
    if (!user) {
      throw new HTTPException(409, { message: "Setup has already completed" });
    }
    logger.info({ userId: user.id, username: user.username }, "initial admin created");
    const tokens = await issueTokens({
      userId: user.id,
      username: user.username,
      isAdmin: user.permissions.admin,
      permissions: permissionsToList(user.permissions),
    });
    await storeRefreshToken({
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + TOKEN_TTL.refresh * 1000),
    });
    setRefreshCookie(c, tokens.refreshToken);
    return c.json(tokens, 201);
  })

  .post("/auth/login", sValidator("json", LoginBody), async (c) => {
    const { username, password } = c.req.valid("json");
    const user = await findByUsername(username);
    if (!user || !(await verifyPassword(user, password))) {
      throw new HTTPException(401, { message: "Invalid credentials" });
    }
    const tokens = await issueTokens({
      userId: user.id,
      username: user.username,
      isAdmin: user.permissions.admin,
      permissions: permissionsToList(user.permissions),
    });
    await storeRefreshToken({
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + TOKEN_TTL.refresh * 1000),
    });
    setRefreshCookie(c, tokens.refreshToken);
    return c.json(tokens);
  })

  .post("/auth/refresh", async (c) => {
    let token: string | undefined =
      getCookie(c, REFRESH_COOKIE) ?? undefined;
    if (!token) {
      const body = await c.req.json().catch(() => null);
      const parsed = RefreshBody(body);
      if (!(parsed instanceof type.errors)) token = parsed.refreshToken;
    }
    if (!token) throw new HTTPException(401, { message: "Missing refresh token" });

    const stored = await findActiveRefreshToken(token);
    if (!stored) throw new HTTPException(401, { message: "Refresh token invalid or expired" });

    let claims;
    try {
      claims = await verifyToken(token);
    } catch {
      throw new HTTPException(401, { message: "Refresh token signature invalid" });
    }
    if (claims["type"] !== "refresh") {
      throw new HTTPException(401, { message: "Not a refresh token" });
    }

    const user = await findById(stored.userId);
    if (!user) throw new HTTPException(401, { message: "User no longer exists" });

    // Rotate.
    await revokeRefreshToken(token);
    const tokens = await issueTokens({
      userId: user.id,
      username: user.username,
      isAdmin: user.permissions.admin,
      permissions: permissionsToList(user.permissions),
    });
    await storeRefreshToken({
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + TOKEN_TTL.refresh * 1000),
    });
    setRefreshCookie(c, tokens.refreshToken);
    return c.json(tokens);
  })

  .post("/auth/logout", async (c) => {
    const token = getCookie(c, REFRESH_COOKIE);
    if (token) await revokeRefreshToken(token);
    deleteCookie(c, REFRESH_COOKIE, { path: "/api/v1/auth" });
    return c.json({ ok: true });
  })

  .get("/auth/me", authRequired, async (c) => {
    const u = c.var.user!;
    return c.json({
      id: u.id,
      username: u.username,
      isAdmin: u.isAdmin,
      permissions: u.permissions,
    });
  })

  // Remote-auth (header-based proxy authentication). Mirrors Booklore's
  // /api/v1/auth/remote behavior: read configurable headers, auto-create
  // user when REMOTE_AUTH_CREATE_NEW_USERS=true, return tokens.
  .get("/auth/remote", async (c) => {
    if (!env.REMOTE_AUTH_ENABLED) {
      throw new HTTPException(404, { message: "Remote auth disabled" });
    }
    const username = c.req.header(env.REMOTE_AUTH_HEADER_USER);
    const email = c.req.header(env.REMOTE_AUTH_HEADER_EMAIL);
    const name = c.req.header(env.REMOTE_AUTH_HEADER_NAME);
    const groupsRaw = c.req.header(env.REMOTE_AUTH_HEADER_GROUPS);
    if (!username) {
      throw new HTTPException(401, {
        message: `Missing ${env.REMOTE_AUTH_HEADER_USER} header`,
      });
    }

    let user = await findByUsername(username);
    if (!user) {
      if (!env.REMOTE_AUTH_CREATE_NEW_USERS) {
        throw new HTTPException(403, { message: "User auto-provisioning disabled" });
      }
      const groups = groupsRaw
        ? groupsRaw.split(new RegExp(env.REMOTE_AUTH_GROUPS_DELIMITER))
        : [];
      const isAdmin = env.REMOTE_AUTH_ADMIN_GROUP
        ? groups.includes(env.REMOTE_AUTH_ADMIN_GROUP)
        : false;
      user = await createLocalUser({
        username,
        // Random password; user never logs in locally.
        password: crypto.randomUUID() + crypto.randomUUID(),
        name: name ?? undefined,
        email: email ?? undefined,
        isAdmin,
      });
      logger.info({ username, isAdmin }, "remote-auth provisioned user");
    }

    const tokens = await issueTokens({
      userId: user.id,
      username: user.username,
      isAdmin: user.permissions.admin,
      permissions: permissionsToList(user.permissions),
    });
    await storeRefreshToken({
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + TOKEN_TTL.refresh * 1000),
    });
    setRefreshCookie(c, tokens.refreshToken);
    return c.json(tokens);
  })

  .post("/auth/revoke-all", authRequired, async (c) => {
    await revokeAllForUser(c.var.user!.id);
    deleteCookie(c, REFRESH_COOKIE, { path: "/api/v1/auth" });
    return c.json({ ok: true });
  });
