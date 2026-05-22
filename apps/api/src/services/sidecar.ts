import * as path from "node:path";
import * as fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { resolveBookFile } from "./files.ts";
import { saveCover } from "./covers.ts";
import { updateBookMetadata } from "./metadata.ts";
import { logger } from "../logger.ts";

/**
 * Calibre stores `cover.jpg` + `metadata.opf` next to each book file. We
 * support reading those sidecars (importing them as metadata) and writing
 * them out (exporting the DB's current view).
 *
 * Sidecar lookup uses the same directory as the book file. Cover sidecar
 * is preferred over the file's embedded cover when both exist.
 */

const COVER_NAMES = ["cover.jpg", "cover.jpeg", "cover.png", "cover.webp"];

function pickMime(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

export async function readSidecars(bookId: string): Promise<{
  cover: { path: string; mime: string } | null;
  opf: string | null;
  metadataJson: Record<string, unknown> | null;
}> {
  const resolved = await resolveBookFile(bookId);
  if (!resolved) return { cover: null, opf: null, metadataJson: null };
  const dir = path.dirname(resolved.absolutePath);

  let cover: { path: string; mime: string } | null = null;
  for (const name of COVER_NAMES) {
    const p = path.join(dir, name);
    if (await fileExists(p)) {
      cover = { path: p, mime: pickMime(path.extname(name)) };
      break;
    }
  }

  const opfPath = path.join(dir, "metadata.opf");
  const opf = (await fileExists(opfPath)) ? await fs.readFile(opfPath, "utf8") : null;

  const jsonPath = path.join(dir, "metadata.json");
  let metadataJson: Record<string, unknown> | null = null;
  if (await fileExists(jsonPath)) {
    try {
      metadataJson = JSON.parse(await fs.readFile(jsonPath, "utf8"));
    } catch (e) {
      logger.warn({ err: e, jsonPath }, "metadata.json parse failed");
    }
  }
  return { cover, opf, metadataJson };
}

/**
 * Import sidecars: read cover.jpg / metadata.json and apply them to the book.
 * (OPF parsing reuses the extractor's OPF code; for first cut we just expose
 * the raw content via the GET endpoint and let the user write metadata
 * manually via /books/:id/metadata.)
 */
export async function importSidecars(bookId: string): Promise<{
  coverImported: boolean;
  metadataJsonImported: boolean;
}> {
  const { cover, metadataJson } = await readSidecars(bookId);
  let coverImported = false;
  if (cover) {
    const bytes = new Uint8Array(await Bun.file(cover.path).arrayBuffer());
    await saveCover(bookId, bytes, cover.mime);
    coverImported = true;
  }
  let metadataJsonImported = false;
  if (metadataJson && typeof metadataJson === "object") {
    // Apply only the well-known keys; ignore unknown ones rather than fail.
    const patch: Record<string, unknown> = {};
    for (const key of [
      "title",
      "subtitle",
      "description",
      "publisher",
      "publishedDate",
      "isbn10",
      "isbn13",
      "asin",
      "pageCount",
      "language",
      "rating",
      "ageRating",
      "seriesName",
      "seriesNumber",
    ]) {
      if (key in metadataJson) patch[key] = (metadataJson as Record<string, unknown>)[key];
    }
    if (Array.isArray((metadataJson as Record<string, unknown>)["authors"])) {
      patch["authors"] = (metadataJson as Record<string, unknown>)["authors"];
    }
    if (Array.isArray((metadataJson as Record<string, unknown>)["categories"])) {
      patch["categories"] = (metadataJson as Record<string, unknown>)["categories"];
    }
    if (Object.keys(patch).length > 0) {
      await updateBookMetadata(bookId, patch);
      metadataJsonImported = true;
    }
  }
  return { coverImported, metadataJsonImported };
}

/**
 * Export sidecars: write the current DB metadata + cover to disk next to the
 * book file as `metadata.json` and `cover.jpg`.
 */
export async function exportSidecars(bookId: string): Promise<{
  coverWritten: boolean;
  metadataWritten: boolean;
}> {
  const resolved = await resolveBookFile(bookId);
  if (!resolved) throw new Error("Book not found");
  const dir = path.dirname(resolved.absolutePath);
  const db = requireDb();

  // Metadata.
  const metaRows = await db
    .select()
    .from(schema.bookMetadata)
    .where(eq(schema.bookMetadata.bookId, bookId))
    .limit(1);
  const meta = metaRows[0];
  let metadataWritten = false;
  if (meta) {
    const authorsRows = await db
      .select({ name: schema.authors.name })
      .from(schema.bookMetadataAuthorMapping)
      .innerJoin(schema.authors, eq(schema.authors.id, schema.bookMetadataAuthorMapping.authorId))
      .where(eq(schema.bookMetadataAuthorMapping.bookId, bookId));
    const json = {
      title: meta.title,
      subtitle: meta.subtitle,
      description: meta.description,
      publisher: meta.publisher,
      publishedDate: meta.publishedDate,
      isbn10: meta.isbn10,
      isbn13: meta.isbn13,
      asin: meta.asin,
      pageCount: meta.pageCount,
      language: meta.language,
      rating: meta.rating,
      ageRating: meta.ageRating,
      seriesName: meta.seriesName,
      seriesNumber: meta.seriesNumber,
      authors: authorsRows.map((a) => a.name),
    };
    await fs.writeFile(path.join(dir, "metadata.json"), JSON.stringify(json, null, 2), "utf8");
    metadataWritten = true;
  }

  // Cover.
  const coversDir = `${process.cwd()}/.data/covers`;
  let coverWritten = false;
  for (const ext of [".jpg", ".png", ".webp"]) {
    const src = path.join(coversDir, `${bookId}${ext}`);
    if (await fileExists(src)) {
      const dest = path.join(dir, `cover${ext}`);
      await fs.copyFile(src, dest);
      coverWritten = true;
      break;
    }
  }

  return { coverWritten, metadataWritten };
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
