import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { constants } from "node:fs";
import { authRequired } from "../middleware/auth.ts";
import { env } from "../env.ts";
import { logger } from "../logger.ts";

/**
 * Server-side directory browser. Self-hosted apps that ingest files from a
 * filesystem the user can't see in the browser (the server's disk, or inside a
 * container) need this — `<input type=file webkitdirectory>` only shows the
 * user's machine, so it's useless for picking `/data/books` on the server.
 *
 * Permission: any signed-in user with `manipulateLibrary` (or admin). The
 * blast radius is "can list directory names the api process can read" — bound
 * further with FS_BROWSE_ROOT if you want to lock the picker to e.g. /data.
 */

const NOISE_PREFIXES = ["/proc", "/sys", "/dev", "/run", "/snap", "/boot"];

function requireBrowse(u: { isAdmin: boolean; permissions: string[] }) {
  if (!u.isAdmin && !u.permissions.includes("manipulateLibrary")) {
    throw new HTTPException(403, { message: "Filesystem browsing not permitted" });
  }
}

// Arktype morphs strings to booleans for query coercion — query params arrive
// as strings, so `?showHidden=true` deserializes to `true`. Native arktype
// "boolean" would reject the string form.
const ListQuery = type({
  "path?": "string > 0",
  "showHidden?": "'true' | 'false' | boolean",
});

const CheckQuery = type({
  path: "string > 0",
});

/**
 * Return a normalized absolute path bounded by FS_BROWSE_ROOT (if set).
 * Throws HTTPException(400) on traversal attempts.
 */
function resolveBounded(raw: string | undefined): string {
  const root = env.FS_BROWSE_ROOT ?? "/";
  if (!raw) return root;
  const abs = path.resolve(root, raw.startsWith("/") ? raw.slice(1) : raw);
  // Guard against `..` segments escaping the root.
  const normalizedRoot = path.resolve(root);
  if (normalizedRoot !== "/" && !abs.startsWith(normalizedRoot + path.sep) && abs !== normalizedRoot) {
    throw new HTTPException(400, { message: "Path escapes browse root" });
  }
  return abs;
}

/**
 * Detect bind/volume mountpoints by reading /proc/self/mountinfo. Lazily
 * loaded and memoized for the process lifetime — mounts rarely change at
 * runtime in a container. Returns a Set of absolute mountpoint paths.
 */
let mountpointCache: Set<string> | null = null;
async function getMountpoints(): Promise<Set<string>> {
  if (mountpointCache) return mountpointCache;
  try {
    const text = await fs.readFile("/proc/self/mountinfo", "utf8");
    const set = new Set<string>();
    // Field 5 (1-indexed) is the mount point. Format documented in
    // proc(5): mount-id parent-id major:minor root mountpoint options...
    for (const line of text.split("\n")) {
      const parts = line.split(" ");
      const mp = parts[4];
      if (mp && mp !== "/") set.add(mp);
    }
    mountpointCache = set;
  } catch {
    // Non-Linux or no /proc — mountpoint badging just turns off.
    mountpointCache = new Set();
  }
  return mountpointCache;
}

async function canWrite(absPath: string): Promise<boolean> {
  try {
    await fs.access(absPath, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export const fsRoutes = new Hono()
  .use("*", authRequired)
  .get("/fs/list", sValidator("query", ListQuery), async (c) => {
    requireBrowse(c.var.user!);
    const q = c.req.valid("query");
    const showHidden = q.showHidden === true || q.showHidden === "true";
    const abs = resolveBounded(q.path);

    let stat;
    try {
      stat = await fs.stat(abs);
    } catch (e) {
      logger.debug({ err: e, path: abs }, "fs.list stat failed");
      throw new HTTPException(404, { message: "Path not found" });
    }
    if (!stat.isDirectory()) {
      throw new HTTPException(400, { message: "Not a directory" });
    }

    let dirents;
    try {
      dirents = await fs.readdir(abs, { withFileTypes: true });
    } catch (e) {
      logger.debug({ err: e, path: abs }, "fs.list readdir failed");
      throw new HTTPException(403, { message: "Cannot read directory" });
    }

    const mounts = await getMountpoints();
    const entries = dirents
      .filter((d) => d.isDirectory() || d.isSymbolicLink())
      .filter((d) => showHidden || !d.name.startsWith("."))
      .filter((d) => {
        // Always hide system noise unless the user explicitly asks.
        if (showHidden) return true;
        const full = path.join(abs, d.name);
        return !NOISE_PREFIXES.some((p) => full === p || full.startsWith(p + "/"));
      })
      .map((d) => {
        const full = path.join(abs, d.name);
        return {
          name: d.name,
          isDir: true, // we only kept dirs/symlinks above
          isMount: mounts.has(full),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const root = env.FS_BROWSE_ROOT ?? "/";
    const parent =
      abs === root || abs === "/" ? null : path.dirname(abs);

    return c.json({
      path: abs,
      parent,
      root,
      writable: await canWrite(abs),
      entries,
    });
  })
  .get("/fs/check", sValidator("query", CheckQuery), async (c) => {
    requireBrowse(c.var.user!);
    const abs = resolveBounded(c.req.valid("query").path);
    try {
      const stat = await fs.stat(abs);
      return c.json({
        path: abs,
        exists: true,
        isDir: stat.isDirectory(),
        writable: await canWrite(abs),
      });
    } catch {
      return c.json({ path: abs, exists: false, isDir: false, writable: false });
    }
  });
