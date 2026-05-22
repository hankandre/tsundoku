import { unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import * as path from "node:path";
import type { ExtractorResult } from "./types.ts";

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: true,
});

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const CONTENT_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

/**
 * Comic archives (CBZ — zip; CBR — rar). For CBZ we read ComicInfo.xml (the
 * de-facto comic metadata spec used by ComicRack/Komga/Mylar/Tachiyomi) and
 * pick the first image alphabetically as the cover. CBR (rar) isn't unpacked
 * here — node-unrar-js needs WASM + a license-aware build; CBR support is
 * marked as a follow-up.
 */
export async function extractComic(absPath: string): Promise<ExtractorResult> {
  const ext = path.extname(absPath).toLowerCase();
  if (ext === ".cbr" || ext === ".rar") {
    return { warning: "CBR/RAR not yet supported (needs node-unrar-js)" };
  }

  const buf = new Uint8Array(await Bun.file(absPath).arrayBuffer());
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(buf);
  } catch (e) {
    return { warning: `Unzip failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  let title: string | null = null;
  let publisher: string | null = null;
  let publishedDate: string | null = null;
  let description: string | null = null;
  let pageCount: number | null = null;
  let authors: string[] = [];
  let categories: string[] = [];

  const xmlEntry = Object.keys(files).find(
    (n) => path.basename(n).toLowerCase() === "comicinfo.xml",
  );
  if (xmlEntry) {
    try {
      const info = xml.parse(new TextDecoder().decode(files[xmlEntry]!))?.ComicInfo ?? {};
      title = info.Title ?? info.Series ?? null;
      publisher = info.Publisher ?? null;
      description = info.Summary ?? null;
      pageCount = typeof info.PageCount === "number" ? info.PageCount : null;
      if (info.Year)
        publishedDate = `${info.Year}-${String(info.Month ?? 1).padStart(2, "0")}-01`;
      const writers = typeof info.Writer === "string" ? info.Writer.split(",") : [];
      const inker = typeof info.Inker === "string" ? info.Inker.split(",") : [];
      const penciller = typeof info.Penciller === "string" ? info.Penciller.split(",") : [];
      authors = [...writers, ...inker, ...penciller]
        .map((s) => s.trim())
        .filter(Boolean);
      if (typeof info.Genre === "string")
        categories = info.Genre.split(",").map((s: string) => s.trim()).filter(Boolean);
    } catch {
      // Soft-fail; we'll still have the cover.
    }
  }

  const images = Object.keys(files)
    .filter((n) => IMAGE_EXTS.includes(path.extname(n).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (!pageCount) pageCount = images.length;

  const coverName = images[0];
  const coverBuf = coverName ? files[coverName] : undefined;
  const cover = coverBuf
    ? {
        bytes: coverBuf,
        contentType: CONTENT_BY_EXT[path.extname(coverName!).toLowerCase()] ?? "image/jpeg",
      }
    : null;

  return {
    title,
    authors,
    publisher,
    publishedDate,
    description,
    pageCount,
    categories,
    cover,
  };
}
