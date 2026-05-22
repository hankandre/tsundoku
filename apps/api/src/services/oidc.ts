import * as client from "openid-client";
import { eq } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { env } from "../env.ts";
import { logger } from "../logger.ts";

/**
 * OIDC configuration is layered: app_settings (DB) overrides env vars. Env vars
 * stay as a bootstrap fallback so existing deployments keep working without a
 * DB-side config row. The admin Settings panel writes to app_settings under
 * category="oidc"; on save the admin route calls `clearOidcCache()` so the
 * next request rediscovers the provider.
 *
 *   app_settings rows:
 *     oidc / provider_details        — JSON ProviderDetails (issuerUri, clientId, ...)
 *     oidc / enabled                 — boolean
 *     oidc / session_duration_hours  — number (informational, used by token TTL caller)
 *     oidc / auto_provision          — JSON AutoProvision
 */

export interface OidcClaimMapping {
  username?: string | null;
  email?: string | null;
  name?: string | null;
  groups?: string | null;
}

export interface OidcProviderDetails {
  providerName?: string | null;
  issuerUri: string;
  clientId: string;
  clientSecret?: string | null;
  scopes?: string | null;
  claimMapping?: OidcClaimMapping | null;
}

export interface OidcAutoProvision {
  enabled?: boolean;
  allowLocalLinking?: boolean;
}

interface OidcEffective {
  provider: OidcProviderDetails | null;
  enabled: boolean;
  sessionDurationHours: number;
  autoProvision: OidcAutoProvision;
  source: "settings" | "env" | "none";
}

let _cache: OidcEffective | null = null;
let _configClient: client.Configuration | null = null;

/** Invalidate the cached effective config + discovery client. Call after saving any oidc/* setting. */
export function clearOidcCache(): void {
  _cache = null;
  _configClient = null;
}

function envProviderDetails(): OidcProviderDetails | null {
  if (!env.OIDC_ISSUER || !env.OIDC_CLIENT_ID) return null;
  return {
    providerName: "Bootstrap",
    issuerUri: env.OIDC_ISSUER,
    clientId: env.OIDC_CLIENT_ID,
    clientSecret: env.OIDC_CLIENT_SECRET ?? null,
    scopes: "openid profile email",
    claimMapping: {
      username: "preferred_username",
      email: "email",
      name: "name",
      groups: "groups",
    },
  };
}

async function readFromAppSettings(): Promise<Partial<OidcEffective>> {
  try {
    const db = requireDb();
    const rows = await db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.category, "oidc"));
    const byName = new Map(rows.map((r) => [r.name, r.val] as const));
    const provider =
      (byName.get("provider_details") as OidcProviderDetails | null) ?? null;
    const enabled = (byName.get("enabled") as boolean | null) ?? false;
    const sessionDurationHours =
      (byName.get("session_duration_hours") as number | null) ?? 24;
    const autoProvision =
      (byName.get("auto_provision") as OidcAutoProvision | null) ?? {};
    return { provider, enabled, sessionDurationHours, autoProvision };
  } catch (err) {
    logger.warn({ err }, "oidc: unable to read app_settings, falling back to env");
    return {};
  }
}

async function loadEffective(): Promise<OidcEffective> {
  const fromDb = await readFromAppSettings();
  if (fromDb.provider) {
    return {
      provider: fromDb.provider,
      enabled: fromDb.enabled === true,
      sessionDurationHours: fromDb.sessionDurationHours ?? 24,
      autoProvision: fromDb.autoProvision ?? {},
      source: "settings",
    };
  }
  const envProvider = envProviderDetails();
  return {
    provider: envProvider,
    // Env-only deployments are implicitly enabled when issuer+clientId are set.
    enabled: !!envProvider && !env.FORCE_DISABLE_OIDC,
    sessionDurationHours: fromDb.sessionDurationHours ?? 24,
    autoProvision: fromDb.autoProvision ?? {},
    source: envProvider ? "env" : "none",
  };
}

async function getEffective(): Promise<OidcEffective> {
  if (_cache) return _cache;
  _cache = await loadEffective();
  return _cache;
}

export async function oidcEnabled(): Promise<boolean> {
  if (env.FORCE_DISABLE_OIDC) return false;
  const eff = await getEffective();
  return (
    eff.enabled && !!eff.provider?.issuerUri && !!eff.provider?.clientId
  );
}

export async function getOidcStatus() {
  const eff = await getEffective();
  return {
    enabled: await oidcEnabled(),
    issuer: eff.provider?.issuerUri ?? null,
    source: eff.source,
    forceDisabledByEnv: env.FORCE_DISABLE_OIDC,
    redirectUri: env.OIDC_REDIRECT_URI ?? null,
  };
}

/**
 * Returns the full effective provider details (sans secret) so admin UIs
 * can render the configured values. The secret is replaced with a sentinel
 * "********" iff a secret is stored, so the form can show "(set)" without
 * leaking the value.
 */
export async function getAdminOidcConfig() {
  const eff = await getEffective();
  return {
    enabled: eff.enabled,
    source: eff.source,
    sessionDurationHours: eff.sessionDurationHours,
    autoProvision: eff.autoProvision,
    provider: eff.provider
      ? {
          providerName: eff.provider.providerName ?? null,
          issuerUri: eff.provider.issuerUri,
          clientId: eff.provider.clientId,
          clientSecretSet: !!eff.provider.clientSecret,
          scopes: eff.provider.scopes ?? null,
          claimMapping: eff.provider.claimMapping ?? null,
        }
      : null,
    env: {
      forceDisabled: env.FORCE_DISABLE_OIDC,
      redirectUri: env.OIDC_REDIRECT_URI ?? null,
      issuerSet: !!env.OIDC_ISSUER,
      clientIdSet: !!env.OIDC_CLIENT_ID,
      clientSecretSet: !!env.OIDC_CLIENT_SECRET,
    },
  };
}

export async function getOidcConfig(): Promise<client.Configuration> {
  if (_configClient) return _configClient;
  const eff = await getEffective();
  if (!eff.provider) {
    throw new Error("OIDC is not configured (no provider details in app_settings or env)");
  }
  _configClient = await client.discovery(
    new URL(eff.provider.issuerUri),
    eff.provider.clientId,
    eff.provider.clientSecret ?? undefined,
  );
  return _configClient;
}

export function redirectUri(): string {
  if (!env.OIDC_REDIRECT_URI) throw new Error("OIDC_REDIRECT_URI not set");
  return env.OIDC_REDIRECT_URI;
}

/** Returns the requested scope string for the authorization URL. */
export async function oidcScopes(): Promise<string> {
  const eff = await getEffective();
  return eff.provider?.scopes?.trim() || "openid profile email";
}

/** Returns the configured claim names with sensible fallbacks. */
export async function oidcClaimNames(): Promise<{
  username: string;
  email: string;
  name: string;
  groups: string;
}> {
  const eff = await getEffective();
  const m = eff.provider?.claimMapping ?? {};
  return {
    username: m.username || "preferred_username",
    email: m.email || "email",
    name: m.name || "name",
    groups: m.groups || "groups",
  };
}
