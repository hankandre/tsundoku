import type { MetadataProvider, MetadataMatch, ProviderSearchInput } from "./types.ts";
import { googleBooks } from "./google-books.ts";

const REGISTRY: Map<string, MetadataProvider> = new Map();
REGISTRY.set(googleBooks.id, googleBooks);

export function getProvider(id: string): MetadataProvider | null {
  return REGISTRY.get(id) ?? null;
}

export function listProviders(): MetadataProvider[] {
  return [...REGISTRY.values()];
}

/**
 * Fan out search across every registered provider, swallowing per-provider
 * errors so one failing source doesn't kill the whole result.
 */
export async function searchAll(
  input: ProviderSearchInput,
): Promise<{ matches: MetadataMatch[]; errors: { providerId: string; error: string }[] }> {
  const results = await Promise.allSettled(
    [...REGISTRY.values()].map(async (p) => ({ id: p.id, matches: await p.search(input) })),
  );
  const matches: MetadataMatch[] = [];
  const errors: { providerId: string; error: string }[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") matches.push(...r.value.matches);
    else {
      errors.push({
        providerId: "unknown",
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  }
  return { matches, errors };
}

export type { MetadataMatch, MetadataProvider } from "./types.ts";
