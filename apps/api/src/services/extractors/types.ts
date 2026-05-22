/** Common shape returned by each per-format extractor. */
export type ExtractedMetadata = {
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  authors?: string[];
  categories?: string[];
  publisher?: string | null;
  publishedDate?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  pageCount?: number | null;
  language?: string | null;
  seriesName?: string | null;
  seriesNumber?: number | null;
  /** Raw image bytes for the cover, if the file embeds one. */
  cover?: {
    bytes: Uint8Array;
    /** "image/jpeg", "image/png", etc. — for the cache write + Content-Type. */
    contentType: string;
  } | null;
};

export type ExtractorResult = ExtractedMetadata & {
  /** Set when the extractor couldn't parse but didn't fully fail (e.g. truncated). */
  warning?: string;
};
