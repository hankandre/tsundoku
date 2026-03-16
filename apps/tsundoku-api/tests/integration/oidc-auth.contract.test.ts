import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { createHash } from "node:crypto";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { app } from "../../src/app";

type OidcStateResponse = {
  state: string;
};

type ErrorResponse = {
  status: number;
  message: string;
};

const issuerUrl = "https://issuer.example.com";
const tokenEndpointUrl = `${issuerUrl}/oauth2/token`;
const jwksEndpointUrl = `${issuerUrl}/oauth2/jwks`;
const clientId = "tsundoku-client";

let signingPrivateKey: CryptoKey;
let signingPublicJwk: Awaited<ReturnType<typeof exportJWK>>;
const oidcProviderServer = setupServer();

const createOidcState = async (): Promise<string> => {
  const stateResponse = await app.request("/api/v1/auth/oidc/state");
  expect(stateResponse.status).toBe(200);

  const stateBody = (await stateResponse.json()) as OidcStateResponse;
  expect(typeof stateBody.state).toBe("string");
  expect(stateBody.state.length).toBeGreaterThan(10);

  return stateBody.state;
};

const computeAtHash = (accessToken: string): string => {
  const hash = createHash("sha256").update(accessToken, "ascii").digest();
  const leftHalf = hash.subarray(0, hash.length / 2);
  return leftHalf.toString("base64url");
};

const buildIdToken = async (input: {
  nonce: string;
  subject: string;
  accessToken: string;
  sid?: string;
}): Promise<string> => {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const jwt = new SignJWT({
    nonce: input.nonce,
    at_hash: computeAtHash(input.accessToken),
    sid: input.sid,
    email: "oidc-user@example.com",
    preferred_username: "oidc-user",
    name: "OIDC User",
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key-1", typ: "JWT" })
    .setIssuer(issuerUrl)
    .setAudience(clientId)
    .setSubject(input.subject)
    .setIssuedAt(nowInSeconds)
    .setExpirationTime(nowInSeconds + 60 * 5);

  return jwt.sign(signingPrivateKey);
};

const buildLogoutToken = async (input: {
  subject?: string;
  sid?: string;
  jti: string;
  includeEvent: boolean;
  includeNonce?: boolean;
}): Promise<string> => {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    jti: input.jti,
  };

  if (input.subject) {
    payload.sub = input.subject;
  }
  if (input.sid) {
    payload.sid = input.sid;
  }
  if (input.includeEvent) {
    payload.events = {
      "http://schemas.openid.net/event/backchannel-logout": {},
    };
  }
  if (input.includeNonce) {
    payload.nonce = "should-not-exist";
  }

  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: "test-key-1", typ: "logout+jwt" })
    .setIssuer(issuerUrl)
    .setAudience(clientId)
    .setIssuedAt(nowInSeconds)
    .setExpirationTime(nowInSeconds + 60 * 5);

  return jwt.sign(signingPrivateKey);
};

beforeAll(async () => {
  const keyPair = await generateKeyPair("RS256");
  signingPrivateKey = keyPair.privateKey;
  signingPublicJwk = await exportJWK(keyPair.publicKey);
  signingPublicJwk.kid = "test-key-1";
  signingPublicJwk.alg = "RS256";
  signingPublicJwk.use = "sig";

  process.env.OIDC_ISSUER_URL = issuerUrl;
  process.env.OIDC_CLIENT_ID = clientId;
  process.env.OIDC_CLIENT_SECRET = "super-secret";
  process.env.OIDC_ALLOWED_REDIRECT_URIS = "http://localhost:3000/callback,myapp://callback";
  process.env.OIDC_ALLOWED_APP_REDIRECT_URIS = "myapp://callback";

  oidcProviderServer.listen({ onUnhandledRequest: "error" });
  oidcProviderServer.use(
    http.get(`${issuerUrl}/.well-known/openid-configuration`, () => {
      return HttpResponse.json({
        issuer: issuerUrl,
        token_endpoint: tokenEndpointUrl,
        jwks_uri: jwksEndpointUrl,
      });
    }),
    http.get(jwksEndpointUrl, () => {
      return HttpResponse.json({
        keys: [signingPublicJwk],
      });
    }),
    http.post(tokenEndpointUrl, async ({ request }) => {
      const rawBody = await request.text();
      const params = new URLSearchParams(rawBody);

      const code = params.get("code");
      const nonce = code === "nonce-mismatch-code" ? "unexpected-nonce" : "future-nonce";
      const accessToken = `provider-access-${code ?? "missing-code"}`;
      const refreshToken = `provider-refresh-${code ?? "missing-code"}`;

      if (!code || code === "exchange-error") {
        return HttpResponse.json(
          {
            error: "invalid_grant",
            error_description: "Authorization code is invalid",
          },
          { status: 400 },
        );
      }

      const idToken = await buildIdToken({
        nonce,
        subject: "oidc-subject-123",
        sid: "oidc-session-1",
        accessToken,
      });

      return HttpResponse.json({
        access_token: accessToken,
        id_token: idToken,
        refresh_token: refreshToken,
        token_type: "Bearer",
        expires_in: 300,
      });
    }),
  );
});

afterAll(() => {
  oidcProviderServer.close();
  delete process.env.OIDC_ISSUER_URL;
  delete process.env.OIDC_CLIENT_ID;
  delete process.env.OIDC_CLIENT_SECRET;
  delete process.env.OIDC_ALLOWED_REDIRECT_URIS;
  delete process.env.OIDC_ALLOWED_APP_REDIRECT_URIS;
});

describe("OIDC auth integration contracts", () => {
  it("returns unique generated state tokens", async () => {
    const firstState = await createOidcState();
    const secondState = await createOidcState();

    expect(firstState).not.toBe(secondState);
  });

  it("exchanges authorization code and issues app session tokens", async () => {
    const state = await createOidcState();

    const response = await app.request("/api/v1/auth/oidc/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        code: "future-auth-code",
        codeVerifier: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMN",
        redirectUri: "http://localhost:3000/callback",
        nonce: "future-nonce",
        state,
      }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;

    expect(typeof body.accessToken).toBe("string");
    expect((body.accessToken as string).split(".").length).toBe(3);
    expect(typeof body.refreshToken).toBe("string");
    expect((body.refreshToken as string).split(".").length).toBe(3);
    expect(body.tokenType).toBe("Bearer");
  });

  it("rejects callback with nonce mismatch between request and ID token", async () => {
    const state = await createOidcState();

    const response = await app.request("/api/v1/auth/oidc/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        code: "nonce-mismatch-code",
        codeVerifier: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMN",
        redirectUri: "http://localhost:3000/callback",
        nonce: "future-nonce",
        state,
      }),
    });

    expect(response.status).toBe(401);
    const errorBody = (await response.json()) as ErrorResponse;
    expect(errorBody.message).toContain("OIDC ID token");
  });

  it("consumes state to prevent replay attacks", async () => {
    const state = await createOidcState();
    const callbackPayload = {
      code: "future-auth-code",
      codeVerifier: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMN",
      redirectUri: "http://localhost:3000/callback",
      nonce: "future-nonce",
      state,
    };

    const firstResponse = await app.request("/api/v1/auth/oidc/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(callbackPayload),
    });
    expect(firstResponse.status).toBe(200);

    const replayResponse = await app.request("/api/v1/auth/oidc/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(callbackPayload),
    });

    expect(replayResponse.status).toBe(400);

    const errorBody = (await replayResponse.json()) as ErrorResponse;
    expect(errorBody.message).toBe("Invalid or expired state");
  });

  it("redirects web flow to app callback URI with session tokens", async () => {
    const state = await createOidcState();
    const params = new URLSearchParams({
      code: "future-auth-code",
      code_verifier: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMN",
      redirect_uri: "http://localhost:3000/callback",
      nonce: "future-nonce",
      state,
      app_redirect_uri: "myapp://callback",
    });

    const response = await app.request(`/api/v1/auth/oidc/redirect?${params.toString()}`);
    expect(response.status).toBe(302);

    const locationHeader = response.headers.get("location");
    expect(locationHeader).toBeTruthy();

    const location = new URL(locationHeader as string);
    expect(location.protocol).toBe("myapp:");
    expect(location.hostname).toBe("callback");
    expect(typeof location.searchParams.get("access_token")).toBe("string");
    expect(typeof location.searchParams.get("refresh_token")).toBe("string");
  });

  it("returns 400 for backchannel logout without logout token", async () => {
    const response = await app.request("/api/v1/auth/oidc/backchannel-logout", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "",
    });

    expect(response.status).toBe(400);
  });

  it("accepts a standards-compliant logout token", async () => {
    const logoutToken = await buildLogoutToken({
      jti: "logout-jti-1",
      subject: "oidc-subject-123",
      sid: "oidc-session-1",
      includeEvent: true,
    });

    const response = await app.request("/api/v1/auth/oidc/backchannel-logout", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: `logout_token=${encodeURIComponent(logoutToken)}`,
    });

    expect(response.status).toBe(204);
  });

  it("rejects logout token without backchannel-logout event claim", async () => {
    const logoutToken = await buildLogoutToken({
      jti: "logout-jti-2",
      subject: "oidc-subject-123",
      sid: "oidc-session-1",
      includeEvent: false,
    });

    const response = await app.request("/api/v1/auth/oidc/backchannel-logout", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: `logout_token=${encodeURIComponent(logoutToken)}`,
    });

    expect(response.status).toBe(400);
  });

  it("rejects replayed logout tokens using jti", async () => {
    const logoutToken = await buildLogoutToken({
      jti: "logout-jti-replay",
      subject: "oidc-subject-123",
      sid: "oidc-session-1",
      includeEvent: true,
    });

    const firstResponse = await app.request("/api/v1/auth/oidc/backchannel-logout", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: `logout_token=${encodeURIComponent(logoutToken)}`,
    });
    expect(firstResponse.status).toBe(204);

    const replayResponse = await app.request("/api/v1/auth/oidc/backchannel-logout", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: `logout_token=${encodeURIComponent(logoutToken)}`,
    });
    expect(replayResponse.status).toBe(400);
  });
});
