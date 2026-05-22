import type { ExtractedMetadata } from "../extractors/types.ts";

/**
 * MetadataProvider is the contract every external source (Google Books,
 * Hardcover, ComicVine, Amazon, …) implements. Providers are pluggable —
 * they register at module load by exporting an instance from
 * `services/providers/index.ts`.
 */
export type MetadataMatch = ExtractedMetadata & {
  providerId: string;
  /** Provider-side identifier so the caller can fetch full detail later. */
  externalId: string;
  /** Surface "quality" hint for ranking; 0..1. */
  score?: number;
  /** Cover URL when the provider exposes one (vs. embedded bytes). */
  coverUrl?: string | null;
};

export type ProviderSearchInput = {
  title?: string;
  authors?: string[];
  isbn?: string;
  limit?: number;
};

export type MetadataProvider = {
  id: string;
  name: string;
  search(input: ProviderSearchInput): Promise<MetadataMatch[]>;
};
