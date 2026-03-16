export type OidcCheckStatus = "PASS" | "FAIL" | "WARN" | "SKIP";

export interface OidcProviderDetails {
  providerName?: string;
  clientId?: string;
  clientSecret?: string;
  issuerUri: string;
  scopes?: string;
  claimMapping?: {
    username?: string;
    name?: string;
    email?: string;
    groups?: string;
  };
}

export interface OidcTestCheck {
  name: string;
  status: OidcCheckStatus;
  message: string;
}

export interface OidcTestResult {
  success: boolean;
  checks: OidcTestCheck[];
}

const REQUIRED_SCOPES = ["openid", "profile", "email"];
const REQUEST_TIMEOUT_MS = 10_000;

const normalizeIssuerUri = (issuerUri: string): string => issuerUri.trim().replace(/\/+$/, "");

const parseStringList = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter((entry): entry is string => typeof entry === "string");
};

const getRequiredString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value;
};

const fetchJson = async (url: string): Promise<Record<string, unknown>> => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const body = (await response.json()) as unknown;
  if (!body || typeof body !== "object") {
    throw new Error("Invalid JSON response");
  }

  return body as Record<string, unknown>;
};

export const testOidcConnection = async (providerDetails: OidcProviderDetails): Promise<OidcTestResult> => {
  const checks: OidcTestCheck[] = [];
  let hasFailure = false;

  const issuerUri = normalizeIssuerUri(providerDetails.issuerUri);
  const discoveryUrl = `${issuerUri}/.well-known/openid-configuration`;

  let discoveryDocument: Record<string, unknown>;
  try {
    discoveryDocument = await fetchJson(discoveryUrl);
    checks.push({
      name: "Discovery Document",
      status: "PASS",
      message: `Successfully fetched from ${discoveryUrl}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    checks.push({
      name: "Discovery Document",
      status: "FAIL",
      message: `Failed to fetch: ${message}`,
    });
    return {
      success: false,
      checks,
    };
  }

  const authorizationEndpoint = getRequiredString(discoveryDocument, "authorization_endpoint");
  if (authorizationEndpoint) {
    checks.push({ name: "Authorization Endpoint", status: "PASS", message: authorizationEndpoint });
  } else {
    checks.push({
      name: "Authorization Endpoint",
      status: "FAIL",
      message: "Not found in discovery document",
    });
    hasFailure = true;
  }

  const tokenEndpoint = getRequiredString(discoveryDocument, "token_endpoint");
  if (tokenEndpoint) {
    checks.push({ name: "Token Endpoint", status: "PASS", message: tokenEndpoint });
  } else {
    checks.push({
      name: "Token Endpoint",
      status: "FAIL",
      message: "Not found in discovery document",
    });
    hasFailure = true;
  }

  const jwksUri = getRequiredString(discoveryDocument, "jwks_uri");
  if (jwksUri) {
    checks.push({ name: "JWKS URI", status: "PASS", message: jwksUri });
  } else {
    checks.push({
      name: "JWKS URI",
      status: "FAIL",
      message: "Not found in discovery document",
    });
    hasFailure = true;
  }

  if (jwksUri) {
    try {
      const jwksDocument = await fetchJson(jwksUri);
      const keyCount = Array.isArray(jwksDocument.keys) ? jwksDocument.keys.length : 0;
      checks.push({
        name: "JWKS Keys",
        status: "PASS",
        message: `${keyCount} key(s) found`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      checks.push({
        name: "JWKS Keys",
        status: "FAIL",
        message: `Failed to fetch JWKS: ${message}`,
      });
      hasFailure = true;
    }
  } else {
    checks.push({ name: "JWKS Keys", status: "SKIP", message: "Skipped (no JWKS URI)" });
  }

  const supportedScopes = parseStringList(discoveryDocument.scopes_supported);
  if (supportedScopes) {
    const missingScopes = REQUIRED_SCOPES.filter((scope) => !supportedScopes.includes(scope));
    if (missingScopes.length === 0) {
      checks.push({
        name: "Required Scopes",
        status: "PASS",
        message: "openid, profile, email all supported",
      });
    } else {
      checks.push({
        name: "Required Scopes",
        status: "WARN",
        message: `Missing scopes: ${missingScopes.join(", ")}`,
      });
    }
  } else {
    checks.push({
      name: "Required Scopes",
      status: "WARN",
      message: "scopes_supported not listed in discovery document",
    });
  }

  const responseTypes = parseStringList(discoveryDocument.response_types_supported);
  if (responseTypes && responseTypes.includes("code")) {
    checks.push({
      name: "Response Type 'code'",
      status: "PASS",
      message: "Authorization code flow supported",
    });
  } else if (responseTypes) {
    checks.push({
      name: "Response Type 'code'",
      status: "FAIL",
      message: "Authorization code flow not supported",
    });
    hasFailure = true;
  } else {
    checks.push({
      name: "Response Type 'code'",
      status: "WARN",
      message: "response_types_supported not listed",
    });
  }

  const supportedCodeChallengeMethods = parseStringList(discoveryDocument.code_challenge_methods_supported);
  if (supportedCodeChallengeMethods && supportedCodeChallengeMethods.includes("S256")) {
    checks.push({
      name: "PKCE (S256)",
      status: "PASS",
      message: "S256 code challenge method supported",
    });
  } else if (supportedCodeChallengeMethods) {
    checks.push({
      name: "PKCE (S256)",
      status: "WARN",
      message: `S256 not listed, available: ${supportedCodeChallengeMethods.join(", ")}`,
    });
  } else {
    checks.push({
      name: "PKCE (S256)",
      status: "WARN",
      message: "code_challenge_methods_supported not listed (PKCE may still work)",
    });
  }

  const endSessionEndpoint = getRequiredString(discoveryDocument, "end_session_endpoint");
  if (endSessionEndpoint) {
    checks.push({
      name: "End Session Endpoint",
      status: "PASS",
      message: endSessionEndpoint,
    });
  } else {
    checks.push({
      name: "End Session Endpoint",
      status: "WARN",
      message: "Not available (RP-initiated logout won't work)",
    });
  }

  if (discoveryDocument.backchannel_logout_supported === true) {
    checks.push({
      name: "Back-Channel Logout",
      status: "PASS",
      message: "Supported by provider",
    });
  } else {
    checks.push({
      name: "Back-Channel Logout",
      status: "WARN",
      message: "Not supported or not advertised",
    });
  }

  return {
    success: !hasFailure,
    checks,
  };
};
