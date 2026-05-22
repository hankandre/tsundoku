import { type } from "arktype";

/**
 * Environment parsing. `process.env` values are always `string | undefined`,
 * so the schema treats every field as optional + accepts strings; we morph
 * the few numeric/boolean ones and apply defaults at the export step.
 *
 * Booleans accept "true"/"1" (case-sensitive) as truthy. Anything else
 * (including absent) falls back to the per-key default.
 */

const Bool = type("string").pipe((v): boolean => v === "true" || v === "1");
const PortNum = type("string.integer.parse").to("number > 0");

const EnvShape = type({
  "NODE_ENV?": "'development' | 'production' | 'test'",
  "BOOKLORE_PORT?": PortNum,
  // CORS — comma-separated list of origins. Empty/"*" = wildcard (warns at boot).
  "ALLOWED_ORIGINS?": "string",
  // Postgres connection string consumed by packages/db.
  "DATABASE_URL?": "string > 0",
  // JWT signing secret. Required in non-test environments at runtime; routes
  // that need it will fail clearly if missing, but the app can boot without
  // it during initial scaffolding.
  "JWT_SECRET?": "string >= 32",
  // OIDC — all optional; presence enables the OIDC routes.
  "OIDC_ISSUER?": "string.url",
  "OIDC_CLIENT_ID?": "string",
  "OIDC_CLIENT_SECRET?": "string",
  "OIDC_REDIRECT_URI?": "string.url",
  // Remote-Auth (header-based proxy auth). Mirrors application.yaml.
  "REMOTE_AUTH_ENABLED?": Bool,
  "REMOTE_AUTH_HEADER_NAME?": "string",
  "REMOTE_AUTH_HEADER_USER?": "string",
  "REMOTE_AUTH_HEADER_EMAIL?": "string",
  "REMOTE_AUTH_HEADER_GROUPS?": "string",
  "REMOTE_AUTH_GROUPS_DELIMITER?": "string",
  "REMOTE_AUTH_ADMIN_GROUP?": "string",
  "REMOTE_AUTH_CREATE_NEW_USERS?": Bool,
  "FORCE_DISABLE_OIDC?": Bool,
  "APP_VERSION?": "string",
  "LOG_LEVEL?": "'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'",
  // Bookdrop — folder watched for files dropped in for review/import. Optional.
  "BOOKDROP_PATH?": "string",
  // Redis connection used by BullMQ for task queues. Required for scans/uploads.
  "REDIS_URL?": "string",
  // Optional sandbox root for /fs browsing. When set, the directory picker
  // and library-path validation refuse to traverse outside this prefix.
  // Leave unset in self-hosted installs that want to mount whatever they
  // want; set to e.g. /data in shared-tenant deployments.
  "FS_BROWSE_ROOT?": "string",
});

const parsed = EnvShape(process.env);
if (parsed instanceof type.errors) {
  console.error("Invalid environment configuration:", parsed.summary);
  process.exit(1);
}

export const env = {
  NODE_ENV: parsed.NODE_ENV ?? "development",
  BOOKLORE_PORT: parsed.BOOKLORE_PORT ?? 6060,
  ALLOWED_ORIGINS: parsed.ALLOWED_ORIGINS ?? "*",
  DATABASE_URL: parsed.DATABASE_URL,
  JWT_SECRET: parsed.JWT_SECRET,
  OIDC_ISSUER: parsed.OIDC_ISSUER,
  OIDC_CLIENT_ID: parsed.OIDC_CLIENT_ID,
  OIDC_CLIENT_SECRET: parsed.OIDC_CLIENT_SECRET,
  OIDC_REDIRECT_URI: parsed.OIDC_REDIRECT_URI,
  REMOTE_AUTH_ENABLED: parsed.REMOTE_AUTH_ENABLED ?? false,
  REMOTE_AUTH_HEADER_NAME: parsed.REMOTE_AUTH_HEADER_NAME ?? "Remote-Name",
  REMOTE_AUTH_HEADER_USER: parsed.REMOTE_AUTH_HEADER_USER ?? "Remote-User",
  REMOTE_AUTH_HEADER_EMAIL: parsed.REMOTE_AUTH_HEADER_EMAIL ?? "Remote-Email",
  REMOTE_AUTH_HEADER_GROUPS: parsed.REMOTE_AUTH_HEADER_GROUPS ?? "Remote-Groups",
  REMOTE_AUTH_GROUPS_DELIMITER: parsed.REMOTE_AUTH_GROUPS_DELIMITER ?? "\\s+",
  REMOTE_AUTH_ADMIN_GROUP: parsed.REMOTE_AUTH_ADMIN_GROUP,
  REMOTE_AUTH_CREATE_NEW_USERS: parsed.REMOTE_AUTH_CREATE_NEW_USERS ?? true,
  FORCE_DISABLE_OIDC: parsed.FORCE_DISABLE_OIDC ?? false,
  APP_VERSION: parsed.APP_VERSION ?? "development",
  LOG_LEVEL: parsed.LOG_LEVEL ?? "info",
  BOOKDROP_PATH: parsed.BOOKDROP_PATH,
  REDIS_URL: parsed.REDIS_URL ?? "redis://localhost:6380",
  FS_BROWSE_ROOT: parsed.FS_BROWSE_ROOT,
} as const;

export type Env = typeof env;
