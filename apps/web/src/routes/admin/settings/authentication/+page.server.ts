import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";

type OidcClaimMapping = {
  username?: string | null;
  email?: string | null;
  name?: string | null;
  groups?: string | null;
};

type AdminOidcConfig = {
  enabled: boolean;
  source: "settings" | "env" | "none";
  sessionDurationHours: number;
  autoProvision: { enabled?: boolean; allowLocalLinking?: boolean };
  provider: {
    providerName: string | null;
    issuerUri: string;
    clientId: string;
    clientSecretSet: boolean;
    scopes: string | null;
    claimMapping: OidcClaimMapping | null;
  } | null;
  env: {
    forceDisabled: boolean;
    redirectUri: string | null;
    issuerSet: boolean;
    clientIdSet: boolean;
    clientSecretSet: boolean;
  };
};

export const load: PageServerLoad = async ({ locals }) => {
  const { rpc } = locals;
  const oidcRes = await rpc.api.v1["oidc-config"].$get();
  if (!oidcRes.ok) throw error(oidcRes.status, "Failed to load OIDC config");
  const oidc = (await oidcRes.json()) as AdminOidcConfig;
  return { oidc };
};

function toBool(v: FormDataEntryValue | null): boolean {
  return v === "on" || v === "true" || v === "1";
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const { rpc } = locals;
    const f = await request.formData();
    const issuerUri = strOrNull(f.get("issuerUri"));
    const clientId = strOrNull(f.get("clientId"));
    const providerName = strOrNull(f.get("providerName"));
    // Empty clientSecret means "leave unchanged"; API treats omission as "preserve."
    const clientSecretRaw = String(f.get("clientSecret") ?? "");
    const clientSecret = clientSecretRaw.trim() === "" ? null : clientSecretRaw;
    const scopes = strOrNull(f.get("scopes"));
    const claimMapping = {
      username: strOrNull(f.get("claim_username")),
      email: strOrNull(f.get("claim_email")),
      name: strOrNull(f.get("claim_name")),
      groups: strOrNull(f.get("claim_groups")),
    };
    // Clearing both issuer and clientId means "delete provider."
    const provider =
      !issuerUri && !clientId
        ? null
        : {
            providerName,
            issuerUri: issuerUri ?? "",
            clientId: clientId ?? "",
            ...(clientSecret !== null ? { clientSecret } : {}),
            scopes,
            claimMapping,
          };

    const sessionRaw = String(f.get("sessionDurationHours") ?? "").trim();
    const sessionDurationHours = sessionRaw === "" ? 24 : Number(sessionRaw);
    if (!Number.isFinite(sessionDurationHours) || sessionDurationHours < 1) {
      return fail(400, {
        error: "Session duration must be a positive number.",
        field: "sessionDurationHours" as const,
      });
    }

    const res = await rpc.api.v1["oidc-config"].$put({
      json: {
        provider,
        enabled: toBool(f.get("enabled")),
        sessionDurationHours,
        autoProvision: {
          enabled: toBool(f.get("autoProvision_enabled")),
          allowLocalLinking: toBool(f.get("autoProvision_allowLocalLinking")),
        },
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return fail(res.status, {
        error: `Save failed (${res.status}): ${body || res.statusText}`,
        field: null,
      });
    }
    return { ok: true, savedAt: new Date().toISOString() };
  },
};
