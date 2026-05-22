import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireLogin } from "$lib/server/session";

type BookQuery = {
  search?: string;
  bookType?: "PDF" | "EPUB" | "CBX" | "MOBI" | "AZW3" | "FB2" | "AUDIOBOOK";
  libraryId?: string;
  sort?: "addedOn" | "title" | "rating" | "pageCount";
  direction?: "asc" | "desc";
  page?: string;
  size?: string;
};

/**
 * JSON sidecar for /books — returns the same shape as the loader for a
 * given (filter + page) combination. The InfiniteList in +page.svelte
 * calls this on scroll/Load-more to append the next page.
 *
 * We deliberately keep this in SvelteKit (not direct browser→api) so the
 * httpOnly access cookie stays on the server boundary.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  requireLogin(locals, url.pathname);
  const params = url.searchParams;
  const query: BookQuery = { size: params.get("size") ?? "50" };
  const fields = ["search", "bookType", "libraryId", "sort", "direction", "page"] as const;
  for (const k of fields) {
    const v = params.get(k);
    if (v) (query as Record<string, string>)[k] = v;
  }
  const { rpc } = locals;
  const res = await rpc.api.v1.books.$get({ query });
  if (!res.ok) throw error(res.status, "Failed to load books");
  const body = await res.json();
  return json(body);
};
