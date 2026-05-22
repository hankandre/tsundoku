import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { authRequired, adminRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";
import {
  listUsers,
  adminCreateUser,
  updateUserPermissions,
  deleteUser,
  adminSetPassword,
  listAppSettings,
  setAppSetting,
  listAuditLog,
  listUserLibraryAccess,
  setUserLibraryAccess,
} from "../services/admin.ts";
import { revokeAllForUser } from "../services/refresh-tokens.ts";
import { getUserRestriction, setUserRestriction } from "../services/content-restriction.ts";
import {
  clearOidcCache,
  getAdminOidcConfig,
  type OidcAutoProvision,
  type OidcClaimMapping,
  type OidcProviderDetails,
} from "../services/oidc.ts";

const CreateUserBody = type({
  username: "1 <= string <= 128",
  password: "8 <= string <= 512",
  "name?": "string <= 256",
  "email?": "string.email <= 256",
  "isAdmin?": "boolean",
});

const PermissionsBody = type({
  "upload?": "boolean",
  "download?": "boolean",
  "editMetadata?": "boolean",
  "manipulateLibrary?": "boolean",
  "admin?": "boolean",
});

const AppSettingBody = type({
  category: "1 <= string <= 128",
  name: "1 <= string <= 128",
  val: "unknown",
});

// OIDC provider config posted from the admin UI. The clientSecret is optional:
// when omitted (or empty), the stored secret is left as-is — the UI sends
// nothing rather than the masked sentinel back to us. Issuer + clientId can
// also be empty when an admin is clearing the config.
const OidcClaimMappingBody = type({
  "username?": "string | null",
  "email?": "string | null",
  "name?": "string | null",
  "groups?": "string | null",
});
const OidcProviderBody = type({
  "providerName?": "string <= 128 | null",
  "issuerUri?": "string <= 512 | null",
  "clientId?": "string <= 256 | null",
  "clientSecret?": "string <= 512 | null",
  "scopes?": "string <= 256 | null",
  "claimMapping?": OidcClaimMappingBody.or("null"),
});
const OidcAutoProvisionBody = type({
  "enabled?": "boolean",
  "allowLocalLinking?": "boolean",
});
const OidcConfigBody = type({
  "provider?": OidcProviderBody.or("null"),
  "enabled?": "boolean",
  "sessionDurationHours?": "1 <= number <= 8760",
  "autoProvision?": OidcAutoProvisionBody.or("null"),
});

const LibraryAccessBody = type({
  "libraryIds?": "string.uuid[]",
});

const PasswordBody = type({
  password: "8 <= string <= 512",
});

const RestrictionBody = type({
  maxAgeRating: "(string <= 32) | null",
});

export const adminRoutes = new Hono()
  .use("*", authRequired, adminRequired)
  .get("/users", async (c) => c.json(await listUsers()))
  .post("/users", sValidator("json", CreateUserBody), async (c) => {
    const u = await adminCreateUser(c.req.valid("json"));
    return c.json({ id: u.id, username: u.username }, 201);
  })
  .put(
    "/users/:id/permissions",
    sValidator("param", IdParam),
    sValidator("json", PermissionsBody),
    async (c) => {
      const { id } = c.req.valid("param");
      await updateUserPermissions(id, c.req.valid("json"));
      return c.json({ ok: true });
    },
  )
  .delete("/users/:id", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    await deleteUser(id);
    return c.json({ ok: true });
  })
  // Admin force-set a user's password. The /auth/revoke-all flow already
  // exists for end-users; this is the admin-side equivalent.
  .put(
    "/users/:id/password",
    sValidator("param", IdParam),
    sValidator("json", PasswordBody),
    async (c) => {
      const { id } = c.req.valid("param");
      const { password } = c.req.valid("json");
      await adminSetPassword(id, password);
      // Revoke active refresh tokens so old sessions can't issue new access
      // tokens. Access tokens already in flight expire on their own (15 min).
      await revokeAllForUser(id);
      return c.json({ ok: true });
    },
  )
  // Force-logout-all — revokes refresh tokens without changing the password.
  // Useful for "lost device" flows.
  .post("/users/:id/revoke-sessions", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    await revokeAllForUser(id);
    return c.json({ ok: true });
  })
  // Per-user content restriction (max age rating).
  .get("/users/:id/restriction", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    return c.json({ maxAgeRating: await getUserRestriction(id) });
  })
  .put(
    "/users/:id/restriction",
    sValidator("param", IdParam),
    sValidator("json", RestrictionBody),
    async (c) => {
      const { id } = c.req.valid("param");
      const { maxAgeRating } = c.req.valid("json");
      await setUserRestriction(id, maxAgeRating);
      return c.json({ ok: true });
    },
  )

  .get("/users/:id/libraries", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    return c.json({ libraryIds: await listUserLibraryAccess(id) });
  })
  .put(
    "/users/:id/libraries",
    sValidator("param", IdParam),
    sValidator("json", LibraryAccessBody),
    async (c) => {
      const { id } = c.req.valid("param");
      await setUserLibraryAccess(id, c.req.valid("json").libraryIds ?? []);
      return c.json({ ok: true });
    },
  )

  .get("/app-settings", async (c) => {
    const category = c.req.query("category") ?? undefined;
    return c.json(await listAppSettings(category));
  })
  .put("/app-settings", sValidator("json", AppSettingBody), async (c) => {
    const body = c.req.valid("json");
    await setAppSetting(body);
    // Any oidc/* mutation should invalidate the in-process discovery cache.
    if (body.category === "oidc") clearOidcCache();
    return c.json({ ok: true });
  })

  // OIDC-specific config endpoints. /admin/oidc-config returns the effective
  // provider details (clientSecret replaced by a presence flag) for the admin
  // form; PUT writes back to app_settings under the oidc/* keys and clears
  // the discovery cache so the next request hits the new provider.
  .get("/oidc-config", async (c) => c.json(await getAdminOidcConfig()))
  .put("/oidc-config", sValidator("json", OidcConfigBody), async (c) => {
    const body = c.req.valid("json");
    if ("provider" in body) {
      // Read the existing secret before overwriting, so an empty/missing
      // clientSecret means "keep what we have" rather than "clear it".
      let prevSecret: string | null = null;
      const existing = await listAppSettings("oidc");
      const prevProviderRow = existing.find((r) => r.name === "provider_details");
      if (prevProviderRow?.val && typeof prevProviderRow.val === "object") {
        const v = prevProviderRow.val as OidcProviderDetails;
        prevSecret = v.clientSecret ?? null;
      }
      const next: OidcProviderDetails | null = body.provider
        ? {
            providerName: body.provider.providerName ?? null,
            issuerUri: body.provider.issuerUri ?? "",
            clientId: body.provider.clientId ?? "",
            clientSecret: body.provider.clientSecret?.trim()
              ? body.provider.clientSecret
              : prevSecret,
            scopes: body.provider.scopes ?? null,
            claimMapping: (body.provider.claimMapping ?? null) as OidcClaimMapping | null,
          }
        : null;
      await setAppSetting({ category: "oidc", name: "provider_details", val: next });
    }
    if ("enabled" in body) {
      await setAppSetting({ category: "oidc", name: "enabled", val: body.enabled });
    }
    if ("sessionDurationHours" in body) {
      await setAppSetting({
        category: "oidc",
        name: "session_duration_hours",
        val: body.sessionDurationHours,
      });
    }
    if ("autoProvision" in body) {
      await setAppSetting({
        category: "oidc",
        name: "auto_provision",
        val: (body.autoProvision ?? null) as OidcAutoProvision | null,
      });
    }
    clearOidcCache();
    return c.json({ ok: true });
  })

  .get("/audit-log", async (c) => {
    const limit = Math.min(500, Math.max(1, Number(c.req.query("limit") ?? 100)));
    return c.json(await listAuditLog(limit));
  });
