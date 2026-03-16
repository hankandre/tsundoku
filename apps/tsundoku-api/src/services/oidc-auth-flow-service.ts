import { and, desc, eq } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { createHash } from "node:crypto";
import { db, schema } from "../db/client";
import { env } from "../config/env";
import { fail } from "../http/errors";
import { issueAccessToken, issueRefreshToken } from "../auth/jwt";

const BACKCHANNEL_LOGOUT_EVENT = "http://schemas.openid.net/event/backchannel-logout";
const DISCOVERY_CACHE_TTL_MS = 60 * 60 * 1000;
const LOGOUT_JTI_CACHE_TTL_MS = 60 * 60 * 1000;
const PKCE_VERIFIER_REGEX = /^[A-Za-z0-9._~-]{43,128}$/;

type OidcProviderConfig = {
  issuerUrl: string;
  clientId: string;
  clientSecret: string | null;
  allowedRedirectUris: Set<string>;
  allowedAppRedirectUris: Set<string>;
};

type OidcDiscoveryDocument = {
  issuer: string;
  tokenEndpoint: string;
  jwksUri: string;
};

type OidcTokenEndpointResponse = {
  access_token?: string;
  id_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type OidcIdentity = {
  issuer: string;
  subject: string;
  sid: string | null;
  email: string | null;
  preferredUsername: string | null;
  name: string | null;
};

type LocalSessionTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresInMs: number;
};

const discoveryCache = new Map<string, { document: OidcDiscoveryDocument; expiresAt: number }>();
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const processedLogoutJti = new Map<string, number>();

const ensureDb = () => {
  if (!db) {
    fail(503, "Database is not configured");
  }
  return db;
};

const normalizeIssuer = (issuerUrl: string): string => issuerUrl.replace(/\/+$/, "");

const parseCsvValues = (raw: string | undefined): Set<string> => {
  if (!raw) {
    return new Set<string>();
  }

  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
};

const requireEnvValue = (value: string | undefined, message: string): string => {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    fail(503, message);
    return "";
  }
  return trimmedValue;
};

const requireStringValue = (value: unknown, message: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    fail(401, message);
    return "";
  }
  return value;
};

const getOidcProviderConfig = (): OidcProviderConfig => {
  const issuerUrl = requireEnvValue(process.env.OIDC_ISSUER_URL, "OIDC provider is not configured");
  const clientId = requireEnvValue(process.env.OIDC_CLIENT_ID, "OIDC provider is not configured");

  const allowedRedirectUris = parseCsvValues(process.env.OIDC_ALLOWED_REDIRECT_URIS);
  const allowedAppRedirectUris = parseCsvValues(process.env.OIDC_ALLOWED_APP_REDIRECT_URIS);

  return {
    issuerUrl: normalizeIssuer(issuerUrl),
    clientId,
    clientSecret: process.env.OIDC_CLIENT_SECRET?.trim() ?? null,
    allowedRedirectUris,
    allowedAppRedirectUris,
  };
};

const validatePkceCodeVerifier = (codeVerifier: string): void => {
  if (!PKCE_VERIFIER_REGEX.test(codeVerifier)) {
    fail(400, "Invalid PKCE code verifier");
  }
};

const validateRedirectUri = (redirectUri: string, config: OidcProviderConfig): void => {
  if (config.allowedRedirectUris.size === 0) {
    return;
  }

  if (!config.allowedRedirectUris.has(redirectUri)) {
    fail(400, "Redirect URI is not allowed");
  }
};

const validateAppRedirectUri = (appRedirectUri: string, config: OidcProviderConfig): void => {
  if (config.allowedAppRedirectUris.size === 0) {
    fail(400, "Application redirect URI is not configured");
  }

  if (!config.allowedAppRedirectUris.has(appRedirectUri)) {
    fail(400, "Application redirect URI is not allowed");
  }
};

const getDiscoveryDocument = async (issuerUrl: string): Promise<OidcDiscoveryDocument> => {
  const cachedEntry = discoveryCache.get(issuerUrl);
  const now = Date.now();

  if (cachedEntry && cachedEntry.expiresAt > now) {
    return cachedEntry.document;
  }

  const discoveryResponse = await fetch(`${issuerUrl}/.well-known/openid-configuration`);
  if (!discoveryResponse.ok) {
    fail(503, "OIDC discovery request failed");
  }

  const discoveryBody = (await discoveryResponse.json()) as Record<string, unknown>;
  const issuer = typeof discoveryBody.issuer === "string" ? normalizeIssuer(discoveryBody.issuer) : "";
  const tokenEndpoint =
    typeof discoveryBody.token_endpoint === "string" ? discoveryBody.token_endpoint : "";
  const jwksUri = typeof discoveryBody.jwks_uri === "string" ? discoveryBody.jwks_uri : "";

  if (!issuer || !tokenEndpoint || !jwksUri) {
    fail(503, "OIDC discovery document is missing required fields");
  }

  const document: OidcDiscoveryDocument = {
    issuer,
    tokenEndpoint,
    jwksUri,
  };

  discoveryCache.set(issuerUrl, {
    document,
    expiresAt: now + DISCOVERY_CACHE_TTL_MS,
  });

  return document;
};

const getRemoteJwks = (jwksUri: string): ReturnType<typeof createRemoteJWKSet> => {
  const cachedJwks = jwksCache.get(jwksUri);
  if (cachedJwks) {
    return cachedJwks;
  }

  const jwks = createRemoteJWKSet(new URL(jwksUri));
  jwksCache.set(jwksUri, jwks);
  return jwks;
};

const exchangeAuthorizationCode = async (input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<OidcTokenEndpointResponse> => {
  const config = getOidcProviderConfig();
  const discovery = await getDiscoveryDocument(config.issuerUrl);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });

  if (config.clientSecret) {
    body.set("client_secret", config.clientSecret);
  }

  const tokenResponse = await fetch(discovery.tokenEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const tokenBody = (await tokenResponse.json()) as OidcTokenEndpointResponse;
  if (!tokenResponse.ok || tokenBody.error) {
    fail(401, "OIDC token exchange failed");
  }

  return tokenBody;
};

const mapAlgToHash = (algorithm: string): string => {
  if (algorithm === "RS384" || algorithm === "ES384" || algorithm === "PS384") {
    return "sha384";
  }
  if (algorithm === "RS512" || algorithm === "ES512" || algorithm === "PS512") {
    return "sha512";
  }
  return "sha256";
};

const validateAccessTokenHash = (input: {
  accessToken: string;
  atHash: unknown;
  algorithm: string;
}): void => {
  if (typeof input.atHash !== "string") {
    return;
  }

  const hash = createHash(mapAlgToHash(input.algorithm)).update(input.accessToken, "ascii").digest();
  const leftHalf = hash.subarray(0, hash.length / 2);
  const computedAtHash = leftHalf.toString("base64url");
  if (computedAtHash !== input.atHash) {
    fail(401, "OIDC ID token at_hash mismatch");
  }
};

const validateIdToken = async (input: {
  idToken: string;
  accessToken: string;
  expectedNonce: string;
}): Promise<OidcIdentity> => {
  const config = getOidcProviderConfig();
  const discovery = await getDiscoveryDocument(config.issuerUrl);
  const jwks = getRemoteJwks(discovery.jwksUri);

  const verifiedResult = await jwtVerify(input.idToken, jwks, {
    issuer: discovery.issuer,
    audience: config.clientId,
    algorithms: ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512", "PS256", "PS384", "PS512"],
    typ: "JWT",
    clockTolerance: 30,
  }).catch(() => fail(401, "Invalid OIDC ID token"));

  const payload = verifiedResult.payload;
  const algorithm = verifiedResult.protectedHeader.alg;

  if (!algorithm || typeof algorithm !== "string") {
    fail(401, "OIDC ID token has unsupported algorithm");
  }

  if (payload.nonce !== input.expectedNonce) {
    fail(401, "OIDC ID token nonce mismatch");
  }

  validateAccessTokenHash({
    accessToken: input.accessToken,
    atHash: payload.at_hash,
    algorithm,
  });

  const subject = requireStringValue(payload.sub, "OIDC ID token is missing subject");

  return {
    issuer: typeof payload.iss === "string" ? normalizeIssuer(payload.iss) : discovery.issuer,
    subject,
    sid: typeof payload.sid === "string" ? payload.sid : null,
    email: typeof payload.email === "string" ? payload.email : null,
    preferredUsername:
      typeof payload.preferred_username === "string" ? payload.preferred_username : null,
    name: typeof payload.name === "string" ? payload.name : null,
  };
};

const normalizeUsername = (raw: string): string => {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (normalized.length === 0) {
    return "oidc-user";
  }

  return normalized.slice(0, 255);
};

const deriveUsernameCandidates = (identity: OidcIdentity): string[] => {
  const candidates: string[] = [];

  if (identity.preferredUsername) {
    candidates.push(normalizeUsername(identity.preferredUsername));
  }

  if (identity.email) {
    const emailLocalPart = identity.email.split("@")[0] ?? "";
    candidates.push(normalizeUsername(emailLocalPart));
  }

  candidates.push(normalizeUsername(`oidc-${identity.subject}`));

  return [...new Set(candidates.filter((candidate) => candidate.length > 0))];
};

const findUserById = async (userId: string): Promise<{ id: string; username: string; isDefaultPassword: boolean } | null> => {
  const database = ensureDb();
  const users = await database
    .select({
      id: schema.users.id,
      username: schema.users.username,
      isDefaultPassword: schema.users.isDefaultPassword,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  return users[0] ?? null;
};

const findUserByUsername = async (
  username: string,
): Promise<{ id: string; username: string; isDefaultPassword: boolean } | null> => {
  const database = ensureDb();
  const users = await database
    .select({
      id: schema.users.id,
      username: schema.users.username,
      isDefaultPassword: schema.users.isDefaultPassword,
    })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1);

  return users[0] ?? null;
};

const ensureUserPermissionsRow = async (userId: string): Promise<void> => {
  const database = ensureDb();
  await database
    .insert(schema.userPermissions)
    .values({ userId })
    .onConflictDoNothing();
};

const createOidcUser = async (
  username: string,
  identity: OidcIdentity,
): Promise<{ id: string; username: string; isDefaultPassword: boolean }> => {
  const database = ensureDb();
  const passwordHash = await Bun.password.hash(Bun.randomUUIDv7(), { algorithm: "argon2id" });

  const [createdUser] = await database
    .insert(schema.users)
    .values({
      username,
      passwordHash,
      isDefaultPassword: false,
      name: identity.name ?? username,
      email: identity.email,
      provisioningMethod: "OIDC",
    })
    .returning({
      id: schema.users.id,
      username: schema.users.username,
      isDefaultPassword: schema.users.isDefaultPassword,
    });

  if (!createdUser) {
    fail(500, "Failed to create OIDC user");
  }

  await ensureUserPermissionsRow(createdUser.id);
  return createdUser;
};

const resolveUserForOidcIdentity = async (
  identity: OidcIdentity,
): Promise<{ id: string; username: string; isDefaultPassword: boolean }> => {
  const database = ensureDb();
  const existingSessions = await database
    .select({
      userId: schema.oidcSession.userId,
    })
    .from(schema.oidcSession)
    .where(
      and(
        eq(schema.oidcSession.oidcSubject, identity.subject),
        eq(schema.oidcSession.oidcIssuer, identity.issuer),
        eq(schema.oidcSession.revoked, false),
      ),
    )
    .orderBy(desc(schema.oidcSession.createdAt))
    .limit(1);

  const existingSession = existingSessions[0];
  if (existingSession) {
    const user = await findUserById(existingSession.userId);
    if (user) {
      return user;
    }
  }

  for (const usernameCandidate of deriveUsernameCandidates(identity)) {
    const user = await findUserByUsername(usernameCandidate);
    if (user) {
      return user;
    }
  }

  const candidates = deriveUsernameCandidates(identity);
  const firstCandidate = candidates[0] ?? "oidc-user";
  const suffix = Bun.randomUUIDv7().slice(0, 8);
  const candidatePool = [firstCandidate, `${firstCandidate}-${suffix}`];

  for (const candidate of candidatePool) {
    const existing = await findUserByUsername(candidate);
    if (!existing) {
      return createOidcUser(candidate, identity);
    }
  }

  return createOidcUser(`oidc-user-${suffix}`, identity);
};

const issueLocalSessionTokens = async (input: {
  userId: string;
  username: string;
  isDefaultPassword: boolean;
}): Promise<LocalSessionTokens> => {
  const accessToken = await issueAccessToken(input.username, {
    userId: input.userId,
    isDefaultPassword: input.isDefaultPassword,
  });

  const refreshToken = await issueRefreshToken(input.username, {
    userId: input.userId,
    isDefaultPassword: input.isDefaultPassword,
  });

  const database = ensureDb();
  await database.insert(schema.refreshToken).values({
    userId: input.userId,
    token: refreshToken,
    expiryDate: new Date(Date.now() + env.refreshTokenTtlMs),
    revoked: false,
  });

  return {
    accessToken,
    refreshToken,
    tokenType: "Bearer",
    expiresInMs: env.accessTokenTtlMs,
  };
};

const persistOidcSession = async (input: {
  userId: string;
  identity: OidcIdentity;
  idToken: string;
}): Promise<void> => {
  const database = ensureDb();
  await database.insert(schema.oidcSession).values({
    userId: input.userId,
    oidcSubject: input.identity.subject,
    oidcIssuer: input.identity.issuer,
    oidcSessionId: input.identity.sid,
    idTokenHint: input.idToken,
    revoked: false,
  });
};

const cleanupProcessedLogoutJti = (): void => {
  const now = Date.now();
  for (const [jti, timestamp] of processedLogoutJti.entries()) {
    if (now - timestamp > LOGOUT_JTI_CACHE_TTL_MS) {
      processedLogoutJti.delete(jti);
    }
  }
};

const assertLogoutTokenNotReplayed = (jti: string): void => {
  cleanupProcessedLogoutJti();
  if (processedLogoutJti.has(jti)) {
    fail(400, "Logout token replay detected");
  }
  processedLogoutJti.set(jti, Date.now());
};

const verifyLogoutToken = async (logoutToken: string): Promise<{
  issuer: string;
  subject: string | null;
  sid: string | null;
  jti: string;
}> => {
  const config = getOidcProviderConfig();
  const discovery = await getDiscoveryDocument(config.issuerUrl);
  const jwks = getRemoteJwks(discovery.jwksUri);

  const verifiedResult = await jwtVerify(logoutToken, jwks, {
    issuer: discovery.issuer,
    audience: config.clientId,
    algorithms: ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512", "PS256", "PS384", "PS512"],
    clockTolerance: 30,
  }).catch(() => fail(400, "Invalid OIDC logout token"));

  const payload = verifiedResult.payload;

  const events = payload.events;
  if (!events || typeof events !== "object" || !(BACKCHANNEL_LOGOUT_EVENT in events)) {
    fail(400, "Logout token missing backchannel event claim");
  }

  if (payload.nonce !== undefined) {
    fail(400, "Logout token must not contain nonce");
  }

  const sid = typeof payload.sid === "string" ? payload.sid : null;
  const subject = typeof payload.sub === "string" ? payload.sub : null;
  if (!sid && !subject) {
    fail(400, "Logout token must contain sub or sid");
  }

  const verifiedJti = requireStringValue(payload.jti, "Logout token missing jti");

  assertLogoutTokenNotReplayed(verifiedJti);

  return {
    issuer: typeof payload.iss === "string" ? normalizeIssuer(payload.iss) : discovery.issuer,
    subject,
    sid,
    jti: verifiedJti,
  };
};

const revokeRefreshTokensForUser = async (userId: string): Promise<void> => {
  const database = ensureDb();
  await database
    .update(schema.refreshToken)
    .set({
      revoked: true,
      revocationDate: new Date(),
    })
    .where(eq(schema.refreshToken.userId, userId));
};

export const completeOidcAuthorizationCodeFlow = async (input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  nonce: string;
}): Promise<LocalSessionTokens> => {
  const config = getOidcProviderConfig();
  validatePkceCodeVerifier(input.codeVerifier);
  validateRedirectUri(input.redirectUri, config);

  const tokenResponse = await exchangeAuthorizationCode({
    code: input.code,
    codeVerifier: input.codeVerifier,
    redirectUri: input.redirectUri,
  });

  const validatedIdToken = requireStringValue(
    tokenResponse.id_token,
    "OIDC provider did not return required tokens",
  );
  const validatedAccessToken = requireStringValue(
    tokenResponse.access_token,
    "OIDC provider did not return required tokens",
  );

  const identity = await validateIdToken({
    idToken: validatedIdToken,
    accessToken: validatedAccessToken,
    expectedNonce: input.nonce,
  });

  const user = await resolveUserForOidcIdentity(identity);
  const localSession = await issueLocalSessionTokens({
    userId: user.id,
    username: user.username,
    isDefaultPassword: user.isDefaultPassword,
  });

  await persistOidcSession({
    userId: user.id,
    identity,
    idToken: validatedIdToken,
  });

  return localSession;
};

export const buildOidcAppRedirectUri = async (input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  nonce: string;
  appRedirectUri: string;
}): Promise<string> => {
  const config = getOidcProviderConfig();
  validateAppRedirectUri(input.appRedirectUri, config);

  const sessionTokens = await completeOidcAuthorizationCodeFlow({
    code: input.code,
    codeVerifier: input.codeVerifier,
    redirectUri: input.redirectUri,
    nonce: input.nonce,
  });

  const redirectLocation = new URL(input.appRedirectUri);
  redirectLocation.searchParams.set("access_token", sessionTokens.accessToken);
  redirectLocation.searchParams.set("refresh_token", sessionTokens.refreshToken);
  redirectLocation.searchParams.set("token_type", sessionTokens.tokenType);
  redirectLocation.searchParams.set("expires_in_ms", String(sessionTokens.expiresInMs));
  return redirectLocation.toString();
};

export const processOidcBackchannelLogout = async (logoutToken: string): Promise<void> => {
  const logoutClaims = await verifyLogoutToken(logoutToken);
  const database = ensureDb();

  const sessions = logoutClaims.sid
    ? await database
        .select({
          id: schema.oidcSession.id,
          userId: schema.oidcSession.userId,
        })
        .from(schema.oidcSession)
        .where(
          and(
            eq(schema.oidcSession.oidcSessionId, logoutClaims.sid),
            eq(schema.oidcSession.oidcIssuer, logoutClaims.issuer),
            eq(schema.oidcSession.revoked, false),
          ),
        )
    : await database
        .select({
          id: schema.oidcSession.id,
          userId: schema.oidcSession.userId,
        })
        .from(schema.oidcSession)
        .where(
          and(
            eq(schema.oidcSession.oidcSubject, logoutClaims.subject ?? ""),
            eq(schema.oidcSession.oidcIssuer, logoutClaims.issuer),
            eq(schema.oidcSession.revoked, false),
          ),
        );

  for (const session of sessions) {
    await database
      .update(schema.oidcSession)
      .set({ revoked: true })
      .where(eq(schema.oidcSession.id, session.id));

    await revokeRefreshTokensForUser(session.userId);
  }
};
