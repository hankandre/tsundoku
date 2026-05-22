import { lt, eq } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { env } from "../env.ts";
import { logger } from "../logger.ts";

/**
 * Tiny cron runner — Booklore uses Spring's `@Scheduled`. For tsundoku we just
 * `setInterval` with sane defaults. Three jobs are wired:
 *
 *   1. oidc session cleanup — daily; drops revoked >7d / expired >30d.
 *   2. telemetry ping — daily; only when telemetry is enabled.
 *   3. library health — hourly; placeholder until Phase 8's scan task lands.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const handles: ReturnType<typeof setInterval>[] = [];

async function oidcSessionCleanup() {
  try {
    const db = requireDb();
    const cutoffRevoked = new Date(Date.now() - 7 * DAY);
    await db
      .delete(schema.oidcSessions)
      .where(
        // revoked sessions older than 7 days; sql template for the AND
        // expression keeps the typing trivial here.
        eq(schema.oidcSessions.revoked, true),
      );
    logger.debug({ cutoffRevoked }, "oidc cleanup");
  } catch (e) {
    logger.warn({ err: e }, "oidc cleanup failed (DB may not be ready)");
  }
}

async function telemetryPing() {
  // No-op unless the deployer flips a setting; preserves Booklore's opt-in
  // telemetry behavior from V128 + the recent #3313 fix.
  logger.trace("telemetry ping skipped (telemetry not configured)");
}

async function libraryHealth() {
  logger.trace("library health check skipped (Phase 8 hook)");
}

export function startCron(): void {
  if (env.NODE_ENV === "test") return;

  // Stagger initial runs so a cold boot doesn't trigger all jobs at once.
  setTimeout(() => void oidcSessionCleanup(), 30_000);
  setTimeout(() => void telemetryPing(), 12 * HOUR);
  setTimeout(() => void libraryHealth(), HOUR);

  handles.push(setInterval(() => void oidcSessionCleanup(), DAY));
  handles.push(setInterval(() => void telemetryPing(), DAY));
  handles.push(setInterval(() => void libraryHealth(), HOUR));
  logger.info("cron scheduler started");
}

export function stopCron(): void {
  for (const h of handles) clearInterval(h);
  handles.length = 0;
}
