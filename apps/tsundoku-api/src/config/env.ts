const parsePort = (raw?: string): number => {
  const value = Number(raw ?? "6060");
  if (!Number.isInteger(value) || value <= 0 || value > 65535) {
    throw new Error(`Invalid port: ${raw}`);
  }
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parsePort(process.env.BOOKLORE_PORT),
  appVersion: process.env.APP_VERSION ?? "development",
  allowedOrigins: process.env.ALLOWED_ORIGINS ?? "*",
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET ?? "booklore-dev-insecure-jwt-secret-change-me-2026",
  accessTokenTtlMs: Number(process.env.JWT_ACCESS_TTL_MS ?? 1000 * 60 * 60 * 10),
  refreshTokenTtlMs: Number(process.env.JWT_REFRESH_TTL_MS ?? 1000 * 60 * 60 * 24 * 30),
  remoteAuthEnabled: process.env.REMOTE_AUTH_ENABLED === "true",
  remoteAuthHeaderName: process.env.REMOTE_AUTH_HEADER_NAME ?? "Remote-Name",
  remoteAuthHeaderUser: process.env.REMOTE_AUTH_HEADER_USER ?? "Remote-User",
  remoteAuthHeaderEmail: process.env.REMOTE_AUTH_HEADER_EMAIL ?? "Remote-Email",
  remoteAuthCreateUsers: process.env.REMOTE_AUTH_CREATE_NEW_USERS !== "false",
  bookdropFolder: process.env.BOOKDROP_FOLDER ?? null,
};
