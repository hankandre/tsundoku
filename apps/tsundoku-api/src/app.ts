import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./config/env";
import { requestContext } from "./middleware/request-context";
import { requestLogger } from "./middleware/request-logger";
import { authMiddleware } from "./middleware/auth-middleware";
import { HTTPException } from "hono/http-exception";
import type { AppVariables } from "./types/app-variables";
import { healthcheckRoutes } from "./routes/healthcheck";
import { versionRoutes } from "./routes/version";
import { authRoutes } from "./routes/auth";
import { setupRoutes } from "./routes/setup";
import { userRoutes } from "./routes/users";
import { libraryRoutes } from "./routes/libraries";
import { shelfRoutes } from "./routes/shelves";
import { bookRoutes } from "./routes/books";
import { settingsRoutes } from "./routes/settings";
import { publicSettingsRoutes } from "./routes/public-settings";
import { readingSessionRoutes } from "./routes/reading-sessions";
import { taskRoutes } from "./routes/tasks";
import { magicShelfRoutes } from "./routes/magic-shelves";
import { bookmarkRoutes } from "./routes/bookmarks";
import { bookNoteRoutes } from "./routes/book-notes";
import { auditLogRoutes } from "./routes/audit-logs";
import { bookReviewRoutes } from "./routes/book-reviews";
import { koreaderUserRoutes } from "./routes/koreader-users";
import { pathRoutes } from "./routes/paths";
import { authorRoutes } from "./routes/authors";
import { userStatsRoutes } from "./routes/user-stats";
import { notebookRoutes } from "./routes/notebook";
import { sidecarRoutes } from "./routes/sidecar";
import { iconRoutes } from "./routes/icons";
import { contentRestrictionRoutes } from "./routes/content-restrictions";
import { opdsRoutes } from "./routes/opds";
import { opdsUserRoutes } from "./routes/opds-users";
import { oidcAuthRoutes, oidcGroupMappingRoutes } from "./routes/oidc-auth";
import { errorBody } from "./http/errors";
import type { MiddlewareHandler } from "hono";

type AppOptions = {
  authMiddlewareOverride?: MiddlewareHandler<{ Variables: AppVariables }>;
};

export const createApp = (options?: AppOptions) => {
  const app = new Hono<{ Variables: AppVariables }>();

  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return error.getResponse();
    }

    return c.json(errorBody(500, "An unexpected error occurred."), 500);
  });

  app.use("*", requestContext);
  app.use("*", requestLogger);
  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (env.allowedOrigins === "*" || env.allowedOrigins.trim() === "") {
          return origin;
        }

        const allowlist = env.allowedOrigins
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0);

        if (allowlist.includes(origin)) {
          return origin;
        }

        return allowlist[0] ?? "";
      },
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Authorization", "Cache-Control", "Content-Type", "Range", "If-None-Match"],
      exposeHeaders: ["Content-Disposition", "Accept-Ranges", "Content-Range", "Content-Length", "ETag", "Date"],
      credentials: true,
    }),
  );
  app.use("*", options?.authMiddlewareOverride ?? authMiddleware);

  app.route("/api/v1/healthcheck", healthcheckRoutes);
  app.route("/api/v1/version", versionRoutes);
  app.route("/api/v1/auth", authRoutes);
  app.route("/api/v1/setup", setupRoutes);
  app.route("/api/v1/users", userRoutes);
  app.route("/api/v1/libraries", libraryRoutes);
  app.route("/api/v1/shelves", shelfRoutes);
  app.route("/api/v1/books", bookRoutes);
  app.route("/api/v1/settings", settingsRoutes);
  app.route("/api/v1/public-settings", publicSettingsRoutes);
  app.route("/api/v1/reading-sessions", readingSessionRoutes);
  app.route("/api/v1/tasks", taskRoutes);
  app.route("/api/magic-shelves", magicShelfRoutes);
  app.route("/api/v1/bookmarks", bookmarkRoutes);
  app.route("/api/v1/book-notes", bookNoteRoutes);
  app.route("/api/v1/audit-logs", auditLogRoutes);
  app.route("/api/v1/reviews", bookReviewRoutes);
  app.route("/api/v1/koreader-users", koreaderUserRoutes);
  app.route("/api/v1/path", pathRoutes);
  app.route("/api/v1/authors", authorRoutes);
  app.route("/api/v1/user-stats", userStatsRoutes);
  app.route("/api/v1/notebook", notebookRoutes);
  app.route("/api/v1", sidecarRoutes);
  app.route("/api/v1/icons", iconRoutes);
  app.route("/api/v1", contentRestrictionRoutes);
  app.route("/api/v1/opds", opdsRoutes);
  app.route("/api/v2/opds-users", opdsUserRoutes);
  app.route("/api/v1/auth/oidc", oidcAuthRoutes);
  app.route("/api/v1/admin/oidc-group-mappings", oidcGroupMappingRoutes);

  app.get("/openapi.json", (c) =>
    c.json({
      info: {
        title: "Booklore API (Bun)",
        version: env.appVersion,
      },
      note: "OpenAPI generation is planned as routes complete migration.",
    }),
  );

  return app;
};

export const app = createApp();
