import type { MetadataProvider, MetadataMatch } from "./types.ts";

// Google Books API — no auth required for basic search. Rate-limited per IP.
const BASE = "https://www.googleapis.com/books/v1/volumes";

type GBVolume = {
  id: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    pageCount?: number;
    categories?: string[];
    language?: string;
    averageRating?: number;
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
    };
  };
};

function toMatch(v: GBVolume): MetadataMatch | null {
  const info = v.volumeInfo;
  if (!info) return null;
  const isbn10 = info.industryIdentifiers?.find((i) => i.type === "ISBN_10")?.identifier ?? null;
  const isbn13 = info.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier ?? null;
  // Google's image links are tiny — they're "edge" 128x192 jpegs. We pass the
  // URL through; the caller can fetch + store via the cover cache.
  const coverUrl = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null;
  return {
    providerId: "google-books",
    externalId: v.id,
    title: info.title ?? null,
    subtitle: info.subtitle ?? null,
    authors: info.authors ?? [],
    publisher: info.publisher ?? null,
    publishedDate: info.publishedDate ?? null,
    description: info.description ?? null,
    isbn10,
    isbn13,
    pageCount: info.pageCount ?? null,
    categories: info.categories ?? [],
    language: info.language ?? null,
    coverUrl,
  };
}

export const googleBooks: MetadataProvider = {
  id: "google-books",
  name: "Google Books",

  async search(input) {
    // Build a `q=` query. Prefer ISBN-direct lookup when available.
    let q: string;
    if (input.isbn) {
      q = `isbn:${input.isbn.replace(/[^0-9X]/gi, "")}`;
    } else {
      const parts: string[] = [];
      if (input.title) parts.push(`intitle:${JSON.stringify(input.title)}`);
      if (input.authors?.length) {
        parts.push(`inauthor:${JSON.stringify(input.authors[0])}`);
      }
      q = parts.join("+");
    }
    if (!q) return [];

    const url = `${BASE}?q=${encodeURIComponent(q)}&maxResults=${Math.min(40, input.limit ?? 10)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Google Books returned ${res.status}`);
    }
    const json = (await res.json()) as { items?: GBVolume[] };
    return (json.items ?? []).map(toMatch).filter((m): m is MetadataMatch => !!m);
  },
};
