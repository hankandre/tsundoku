import * as path from "node:path";
import * as fs from "node:fs/promises";
import { env } from "../env.ts";

const COVER_DIR =
  process.env["COVERS_DIR"] ?? path.join(process.cwd(), ".data", "covers");

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

function pickExt(contentType: string): string {
  return EXT_BY_MIME[contentType.toLowerCase()] ?? ".bin";
}

export async function saveCover(
  bookId: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<{ path: string; contentType: string }> {
  await fs.mkdir(COVER_DIR, { recursive: true });
  // Clear any old cover for this book regardless of extension.
  for (const ext of Object.values(EXT_BY_MIME)) {
    await fs.rm(path.join(COVER_DIR, `${bookId}${ext}`), { force: true });
  }
  const dest = path.join(COVER_DIR, `${bookId}${pickExt(contentType)}`);
  await Bun.write(dest, bytes);
  return { path: dest, contentType };
}

export async function findCover(
  bookId: string,
): Promise<{ path: string; contentType: string } | null> {
  for (const [mime, ext] of Object.entries(EXT_BY_MIME)) {
    const candidate = path.join(COVER_DIR, `${bookId}${ext}`);
    try {
      await fs.stat(candidate);
      return { path: candidate, contentType: mime };
    } catch {
      // continue
    }
  }
  return null;
}

export async function deleteCover(bookId: string): Promise<void> {
  for (const ext of Object.values(EXT_BY_MIME)) {
    await fs.rm(path.join(COVER_DIR, `${bookId}${ext}`), { force: true });
  }
}

/** Surfaced for diagnostics. */
export const COVERS_DIR = COVER_DIR;
// `env` is imported just to keep the env validation as a hard dependency at
// boot — it's a no-op here.
void env;
