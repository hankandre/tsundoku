import { parseFile } from "music-metadata";
import type { ExtractorResult } from "./types.ts";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

/**
 * Audiobook metadata via music-metadata (parses ID3, MP4/M4B atoms, FLAC,
 * Vorbis, APE). Maps the common tags onto our ExtractedMetadata shape and
 * pulls the first embedded cover.
 */
export async function extractAudiobook(absPath: string): Promise<ExtractorResult> {
  let meta;
  try {
    meta = await parseFile(absPath);
  } catch (e) {
    return {
      warning: `music-metadata failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const c = meta.common;
  const authors = [c.albumartist, ...(c.artists ?? [])]
    .filter((s): s is string => !!s)
    .map((s) => s.trim())
    .filter((s, i, arr) => arr.indexOf(s) === i);

  const cover = c.picture?.[0]
    ? {
        bytes: new Uint8Array(c.picture[0].data),
        contentType:
          c.picture[0].format ||
          MIME_BY_EXT[(c.picture[0].format ?? "").replace(/^image\//, "")] ||
          "image/jpeg",
      }
    : null;

  return {
    title: c.title ?? c.album ?? null,
    subtitle: c.album && c.album !== c.title ? c.album : null,
    description: c.comment?.[0]?.text ?? null,
    authors,
    publisher: c.label?.[0] ?? null,
    publishedDate: c.year ? String(c.year) : null,
    language: c.language ?? null,
    cover,
  };
}
