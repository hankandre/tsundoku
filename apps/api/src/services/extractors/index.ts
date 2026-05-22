import * as path from "node:path";
import { schema } from "@tsundoku/db";
import type { ExtractorResult } from "./types.ts";
import { extractPdf } from "./pdf.ts";
import { extractEpub } from "./epub.ts";
import { extractAudiobook } from "./audiobook.ts";
import { extractComic } from "./comic.ts";
import { extractFb2 } from "./fb2.ts";
import { extractMobi } from "./mobi.ts";
import { logger } from "../../logger.ts";

export type { ExtractedMetadata, ExtractorResult } from "./types.ts";

export async function extractForType(
  bookType: schema.BookType,
  absPath: string,
): Promise<ExtractorResult> {
  try {
    switch (bookType) {
      case "PDF":
        return await extractPdf(absPath);
      case "EPUB":
        return await extractEpub(absPath);
      case "AUDIOBOOK":
        return await extractAudiobook(absPath);
      case "CBX":
        return await extractComic(absPath);
      case "FB2":
        return await extractFb2(absPath);
      case "MOBI":
      case "AZW3":
        return await extractMobi(absPath);
      default:
        return { warning: `No extractor for ${bookType}` };
    }
  } catch (e) {
    logger.warn({ err: e, absPath, bookType }, "extractor threw");
    return { warning: e instanceof Error ? e.message : String(e) };
  }
}

/** Fallback: derive a best-effort title from the filename when extraction
 *  yielded nothing useful. */
export function titleFromFilename(filename: string): string {
  const stem = path.basename(filename, path.extname(filename));
  return stem.replace(/[_.]+/g, " ").trim();
}
