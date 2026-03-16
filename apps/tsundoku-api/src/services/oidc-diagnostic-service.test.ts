import { afterEach, describe, expect, it } from "bun:test";
import { testOidcConnection } from "./oidc-diagnostic-service";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("testOidcConnection", () => {
  it("returns success when discovery and JWKS checks pass", async () => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = input.toString();

      if (url.endsWith("/.well-known/openid-configuration")) {
        return new Response(
          JSON.stringify({
            authorization_endpoint: "https://issuer.example/authorize",
            token_endpoint: "https://issuer.example/token",
            jwks_uri: "https://issuer.example/jwks",
            scopes_supported: ["openid", "profile", "email"],
            response_types_supported: ["code"],
            code_challenge_methods_supported: ["S256"],
            end_session_endpoint: "https://issuer.example/logout",
            backchannel_logout_supported: true,
          }),
          { status: 200 },
        );
      }

      if (url === "https://issuer.example/jwks") {
        return new Response(JSON.stringify({ keys: [{ kid: "k1" }, { kid: "k2" }] }), { status: 200 });
      }

      return new Response("not-found", { status: 404 });
    }) as typeof fetch;

    const result = await testOidcConnection({
      issuerUri: "https://issuer.example/",
    });

    expect(result.success).toBe(true);
    expect(result.checks.some((check) => check.name === "Discovery Document" && check.status === "PASS")).toBe(true);
    expect(result.checks.some((check) => check.name === "JWKS Keys" && check.message.includes("2 key(s)"))).toBe(true);
  });

  it("returns a failed result when discovery request fails", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;

    const result = await testOidcConnection({
      issuerUri: "https://issuer.example",
    });

    expect(result.success).toBe(false);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0]?.name).toBe("Discovery Document");
    expect(result.checks[0]?.status).toBe("FAIL");
  });
});
