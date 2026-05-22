import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import * as client from "openid-client";
import { eq, and } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import {
  getOidcConfig,
  oidcEnabled,
  redirectUri,
  getOidcStatus,
  oidcScopes,
  oidcClaimNames,
} from "../services/oidc.ts";
import { issueTokens, TOKEN_TTL } from "../services/tokens.ts";
import { storeRefreshToken } from "../services/refresh-tokens.ts";
import { findByUsername, permissionsToList } from "../services/users.ts";
import { env } from "../env.ts";
import { logger } from "../logger.ts";

const OIDC_STATE_COOKIE = "tsundoku_oidc_state";
const OIDC_VERIFIER_COOKIE = "tsundoku_oidc_verifier";

function setShortCookie(c: Context, name: string, value: string) {
  setCookie(c, name, value, {
    httpOnly: true,
    sameSite: "Lax",
    secure: env.NODE_ENV === "production",
    path: "/api/v1/auth/oidc",
    maxAge: 600, // 10 minutes — round trip to provider + back
  });
}

export const oidcRoutes = new Hono()
  .get("/auth/oidc/status", async (c) => c.json(await getOidcStatus()))

  .get("/auth/oidc/redirect", async (c) => {
    if (!(await oidcEnabled())) throw new HTTPException(404, { message: "OIDC disabled" });
    const config = await getOidcConfig();

    const state = client.randomState();
    const verifier = client.randomPKCECodeVerifier();
    const challenge = await client.calculatePKCECodeChallenge(verifier);

    setShortCookie(c, OIDC_STATE_COOKIE, state);
    setShortCookie(c, OIDC_VERIFIER_COOKIE, verifier);

    const url = client.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri(),
      scope: await oidcScopes(),
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return c.redirect(url.href);
  })

  .get("/auth/oidc/callback", async (c) => {
    if (!(await oidcEnabled())) throw new HTTPException(404, { message: "OIDC disabled" });
    const config = await getOidcConfig();

    const expectedState = getCookie(c, OIDC_STATE_COOKIE);
    const verifier = getCookie(c, OIDC_VERIFIER_COOKIE);
    if (!expectedState || !verifier) {
      throw new HTTPException(400, { message: "OIDC state/verifier cookie missing" });
    }
    deleteCookie(c, OIDC_STATE_COOKIE, { path: "/api/v1/auth/oidc" });
    deleteCookie(c, OIDC_VERIFIER_COOKIE, { path: "/api/v1/auth/oidc" });

    const fullUrl = new URL(c.req.url);
    let tokens;
    try {
      tokens = await client.authorizationCodeGrant(config, fullUrl, {
        pkceCodeVerifier: verifier,
        expectedState,
      });
    } catch (e) {
      logger.warn({ err: e }, "oidc code grant failed");
      throw new HTTPException(401, { message: "OIDC authorization failed" });
    }

    const claims = tokens.claims();
    if (!claims) throw new HTTPException(401, { message: "OIDC id_token has no claims" });
    const sub = String(claims.sub);
    const iss = String(claims.iss);
    const claimNames = await oidcClaimNames();
    const username =
      (claims[claimNames.username] as string | undefined) ??
      (claims[claimNames.email] as string | undefined) ??
      sub;
    const email = (claims[claimNames.email] as string | undefined) ?? null;
    const name = (claims[claimNames.name] as string | undefined) ?? null;

    // Find or create the linked local user.
    const db = requireDb();
    let userId: string;
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.oidcSubject, sub), eq(schema.users.oidcIssuer, iss)))
      .limit(1);

    if (existing[0]) {
      userId = existing[0].id;
    } else {
      const inserted = await db
        .insert(schema.users)
        .values({
          username,
          name,
          email,
          oidcSubject: sub,
          oidcIssuer: iss,
        })
        .returning({ id: schema.users.id });
      userId = inserted[0]!.id;
      await db.insert(schema.userPermissions).values({ userId });
    }

    // Track the OIDC session for backchannel logout.
    const sid = claims["sid"] as string | undefined;
    await db.insert(schema.oidcSessions).values({
      userId,
      oidcSubject: sub,
      oidcIssuer: iss,
      oidcSessionId: sid ?? null,
      idTokenHint: tokens.id_token ?? null,
    });

    const user = await findByUsername(username);
    if (!user) throw new HTTPException(500, { message: "User vanished after upsert" });

    const issued = await issueTokens({
      userId: user.id,
      username: user.username,
      isAdmin: user.permissions.admin,
      permissions: permissionsToList(user.permissions),
    });
    await storeRefreshToken({
      userId: user.id,
      token: issued.refreshToken,
      expiresAt: new Date(Date.now() + TOKEN_TTL.refresh * 1000),
    });
    // Redirect back to the web app's post-login page; it'll pick up the access
    // token via /auth/me (cookie-based refresh) on first load.
    setCookie(c, "tsundoku_refresh", issued.refreshToken, {
      httpOnly: true,
      sameSite: "Lax",
      secure: env.NODE_ENV === "production",
      path: "/api/v1/auth",
      maxAge: TOKEN_TTL.refresh,
    });
    return c.redirect("/");
  })

  // Backchannel logout endpoint (OIDC RP-initiated logout token POSTed by the
  // provider). Validates the logout_token and revokes the matching session.
  .post("/auth/oidc/backchannel-logout", async (c) => {
    if (!(await oidcEnabled())) throw new HTTPException(404, { message: "OIDC disabled" });
    const form = await c.req.parseBody().catch(() => null);
    const logoutToken = form?.["logout_token"];
    if (typeof logoutToken !== "string") {
      throw new HTTPException(400, { message: "Missing logout_token" });
    }
    // openid-client doesn't expose a logout-token verifier directly; for
    // Phase 1 we decode unverified and rely on issuer match + sid lookup,
    // matching the original Booklore behavior. A future hardening pass will
    // validate via JWKS.
    const parts = logoutToken.split(".");
    if (parts.length !== 3) throw new HTTPException(400, { message: "Malformed token" });
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      throw new HTTPException(400, { message: "Token payload not JSON" });
    }
    const sub = payload["sub"] as string | undefined;
    const sid = payload["sid"] as string | undefined;
    const iss = payload["iss"] as string | undefined;
    if (!iss) throw new HTTPException(400, { message: "Missing iss claim" });

    const db = requireDb();
    const where = sid
      ? and(eq(schema.oidcSessions.oidcIssuer, iss), eq(schema.oidcSessions.oidcSessionId, sid))
      : sub
        ? and(
            eq(schema.oidcSessions.oidcIssuer, iss),
            eq(schema.oidcSessions.oidcSubject, sub),
          )
        : undefined;
    if (!where) throw new HTTPException(400, { message: "Need sid or sub" });

    const updated = await db
      .update(schema.oidcSessions)
      .set({ revoked: true, revokedAt: new Date() })
      .where(where)
      .returning({ userId: schema.oidcSessions.userId });

    for (const row of updated) {
      await db
        .update(schema.refreshTokens)
        .set({ revoked: true, revocationDate: new Date() })
        .where(eq(schema.refreshTokens.userId, row.userId));
    }
    logger.info({ revoked: updated.length }, "oidc backchannel logout");
    return c.json({ ok: true });
  });
