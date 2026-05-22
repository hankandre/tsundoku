import { cors } from "hono/cors";
import { env } from "../env.ts";
import { logger } from "../logger.ts";

const raw = env.ALLOWED_ORIGINS.trim();

if (raw === "*" || raw === "") {
  logger.warn(
    "CORS allowed-origins is wildcard; configure ALLOWED_ORIGINS in production.",
  );
}

const allowList =
  raw === "*" || raw === ""
    ? "*"
    : raw.split(",").map((o) => o.trim()).filter(Boolean);

export const corsMiddleware = cors({
  origin: allowList as string | string[],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowHeaders: ["Authorization", "Cache-Control", "Content-Type", "Range", "If-None-Match"],
  exposeHeaders: [
    "Content-Disposition",
    "Accept-Ranges",
    "Content-Range",
    "Content-Length",
    "ETag",
    "Date",
  ],
  credentials: true,
  maxAge: 600,
});
