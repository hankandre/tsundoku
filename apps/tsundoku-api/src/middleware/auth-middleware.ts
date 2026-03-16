import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../types/app-variables";
import { verifyToken } from "../auth/jwt";
import { getAuthUserById } from "../auth/user-auth-service";
import { fail } from "../http/errors";

const PUBLIC_PATHS = [
  "/ws/**",
  "/kobo/**",
  "/api/v1/auth/**",
  "/api/v1/public-settings",
  "/api/v1/setup",
  "/api/v1/setup/**",
  "/api/v1/healthcheck",
  "/api/v1/healthcheck/**",
  "/api/v1/version",
  "/api/v1/version/**",
];

const OPDS_PUBLIC = ["/api/v1/opds/search.opds", "/api/v2/opds/search.opds"];

const MEDIA_TOKEN_PATHS = [
  "/api/v1/media/**",
  "/api/v1/custom-fonts/*/file",
  "/api/v1/epub/*/file/**",
  "/api/v1/audiobooks/*/stream/**",
  "/api/v1/audiobooks/*/track/*/stream/**",
  "/api/v1/audiobooks/*/cover",
];

const toRegex = (pattern: string): RegExp => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const doubleStar = escaped.replaceAll("**", "::DOUBLE_STAR::");
  const singleStar = doubleStar.replaceAll("*", "[^/]+");
  const normalized = singleStar.replaceAll("::DOUBLE_STAR::", ".*");
  return new RegExp(`^${normalized}$`);
};

const matchers = {
  public: PUBLIC_PATHS.map((pattern) => toRegex(pattern)),
  media: MEDIA_TOKEN_PATHS.map((pattern) => toRegex(pattern)),
  opdsPublic: OPDS_PUBLIC.map((pattern) => toRegex(pattern)),
};

const isMatch = (path: string, list: RegExp[]) => list.some((regex) => regex.test(path));

const extractToken = (header: string | undefined): string | null => {
  if (!header) {
    return null;
  }

  const [kind, value] = header.split(" ");
  if (kind?.toLowerCase() !== "bearer" || !value) {
    return null;
  }
  return value;
};

const authenticateBearer = async (c: Parameters<MiddlewareHandler<{ Variables: AppVariables }>>[0], token: string) => {
  const claims = await verifyToken(token).catch(() => fail(401, "Invalid token"));

  const authUser = await getAuthUserById(claims.userId);
  if (!authUser) {
    fail(401, "Invalid token");
  }

  c.set("authUser", {
    userId: claims.userId,
    username: authUser!.username,
    isDefaultPassword: authUser!.isDefaultPassword,
    isAdmin: authUser!.isAdmin,
    canManageLibrary: authUser!.canManageLibrary,
    canAccessUserStats: authUser!.canAccessUserStats,
  });
};

export const requireAdmin: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const user = c.get("authUser");
  if (!user?.isAdmin) {
    fail(403, "Forbidden");
  }
  await next();
};

export const authMiddleware: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const path = c.req.path;

  if (isMatch(path, matchers.public)) {
    await next();
    return;
  }

  if (path.startsWith("/api/v1/opds/") || path.startsWith("/api/v2/opds/")) {
    if (isMatch(path, matchers.opdsPublic)) {
      await next();
      return;
    }

    if (!c.req.header("authorization")?.toLowerCase().startsWith("basic ")) {
      fail(401, "HTTP Status 401 - Full authentication is required to access this resource");
    }

    await next();
    return;
  }

  if (path.startsWith("/komga/api/v1/") || path.startsWith("/komga/api/v2/")) {
    if (!c.req.header("authorization")?.toLowerCase().startsWith("basic ")) {
      fail(401, "HTTP Status 401 - Full authentication is required to access this resource");
    }

    await next();
    return;
  }

  const token = extractToken(c.req.header("authorization"));
  if (token) {
    await authenticateBearer(c, token);
    await next();
    return;
  }

  if (isMatch(path, matchers.media)) {
    const queryToken = c.req.query("token");
    if (queryToken) {
      await authenticateBearer(c, queryToken);
      await next();
      return;
    }

    await next();
    return;
  }

  if (path.startsWith("/api/") || path.startsWith("/api/koreader/") || path.startsWith("/api/kobo/") || path.startsWith("/ws/")) {
    fail(401, "Unauthorized");
  }

  await next();
};
