import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { corsMiddleware } from "./middleware/cors.ts";
import { requestId } from "./middleware/request-id.ts";
import { httpLogger } from "./middleware/logger.ts";
import { authOptional } from "./middleware/auth.ts";
import { healthRoutes } from "./routes/health.ts";
import { authRoutes } from "./routes/auth.ts";
import { oidcRoutes } from "./routes/oidc.ts";
import { libraryRoutes } from "./routes/libraries.ts";
import { bookRoutes } from "./routes/books.ts";
import { shelfRoutes } from "./routes/shelves.ts";
import { metadataRoutes } from "./routes/metadata.ts";
import { adminRoutes } from "./routes/admin.ts";
import { readerRoutes } from "./routes/readers.ts";
import { statsRoutes } from "./routes/stats.ts";
import { scanRoutes } from "./routes/scan.ts";
import { uploadRoutes } from "./routes/upload.ts";
import { opdsRoutes } from "./routes/opds.ts";
import { deviceRoutes } from "./routes/devices.ts";
import { bookdropRoutes } from "./routes/bookdrop.ts";
import { authorRoutes } from "./routes/authors.ts";
import { seriesRoutes } from "./routes/series.ts";
import { emailRoutes } from "./routes/email.ts";
import { notebookRoutes } from "./routes/notebook.ts";
import { fontRoutes } from "./routes/fonts.ts";
import { readerPrefsRoutes } from "./routes/reader-prefs.ts";
import { filesAdminRoutes } from "./routes/files-admin.ts";
import { coverAdminRoutes } from "./routes/covers.ts";
import { metadataTaskRoutes } from "./routes/metadata-tasks.ts";
import { audiobookRoutes } from "./routes/audiobook.ts";
import { annotationRoutes } from "./routes/annotations.ts";
import { publicRoutes } from "./routes/public.ts";
import { reviewRoutes } from "./routes/reviews.ts";
import { oidcGroupRoutes } from "./routes/oidc-groups.ts";
import { iconRoutes } from "./routes/icons.ts";
import { sidecarRoutes } from "./routes/sidecar.ts";
import { deviceUserRoutes } from "./routes/device-users.ts";
import { hardcoverRoutes } from "./routes/hardcover.ts";
import { komgaRoutes } from "./routes/komga.ts";
import { additionalFileRoutes } from "./routes/additional-files.ts";
import { fsRoutes } from "./routes/fs.ts";
import { wsHandler } from "./ws/index.ts";
import { logger } from "./logger.ts";

// Built as a single chained expression so Hono's type inference can capture
// every mounted route in the exported `AppType` — required for `hc<AppType>`
// RPC clients (see /docs/guides/best-practices in the Hono docs).
export const app = new Hono()
  .use("*", requestId)
  .use("*", httpLogger)
  .use("*", corsMiddleware)
  .use("*", authOptional)
  // WebSocket upgrade flows through the full middleware stack.
  .get("/ws", wsHandler)
  // Spring's controllers live under /api/v1/*; preserve that contract.
  .route("/api/v1", healthRoutes)
  .route("/api/v1", authRoutes)
  .route("/api/v1", oidcRoutes)
  // Mount order matters: in Hono, a sub-app's `.use("*", mw)` applies to every
  // handler registered AFTER it on the parent. Sub-apps that gate their whole
  // surface (`libraryRoutes`, `bookRoutes`, `shelfRoutes`, `adminRoutes`) leak
  // that middleware onto siblings mounted later. Keep open/self-authenticating
  // routes first, then user-scoped routes, then admin-scoped routes last.
  .route("/api/v1", publicRoutes)
  .route("/api/v1", readerRoutes)
  .route("/api/v1", opdsRoutes)
  .route("/api/v1", deviceRoutes)
  .route("/api/v1", bookRoutes)
  .route("/api/v1", libraryRoutes)
  .route("/api/v1", shelfRoutes)
  .route("/api/v1", metadataRoutes)
  .route("/api/v1", statsRoutes)
  .route("/api/v1", scanRoutes)
  .route("/api/v1", uploadRoutes)
  .route("/api/v1", bookdropRoutes)
  .route("/api/v1", authorRoutes)
  .route("/api/v1", seriesRoutes)
  .route("/api/v1", emailRoutes)
  .route("/api/v1", notebookRoutes)
  .route("/api/v1", fontRoutes)
  .route("/api/v1", readerPrefsRoutes)
  .route("/api/v1", filesAdminRoutes)
  .route("/api/v1", coverAdminRoutes)
  .route("/api/v1", metadataTaskRoutes)
  .route("/api/v1", audiobookRoutes)
  .route("/api/v1", annotationRoutes)
  .route("/api/v1", reviewRoutes)
  .route("/api/v1", iconRoutes)
  .route("/api/v1", sidecarRoutes)
  .route("/api/v1", deviceUserRoutes)
  .route("/api/v1", hardcoverRoutes)
  .route("/api/v1", komgaRoutes)
  .route("/api/v1", additionalFileRoutes)
  .route("/api/v1", fsRoutes)
  // Admin-gated sub-apps use `.use("*", authRequired, adminRequired)` and
  // MUST be mounted last — otherwise every sub-app registered after them
  // inherits adminRequired and silently 403s for non-admin users.
  .route("/api/v1", oidcGroupRoutes)
  .route("/api/v1", adminRoutes)
  .onError((err, c) => {
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    logger.error({ err, reqId: c.var.requestId }, "unhandled error");
    return c.json({ error: "Internal server error" }, 500);
  })
  .notFound((c) => c.json({ error: "Not found", path: c.req.path }, 404));

/** Exported for `hc<AppType>` in the web app. */
export type AppType = typeof app;
