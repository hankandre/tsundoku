import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
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

export const load: PageServerLoad = async ({ locals, cookies, fetch, url }) => {
  requireLogin(locals, url.pathname);
  const search = url.searchParams;

  // Initial page is small for fast TTFB; the client appends subsequent pages
  // via the colocated +server.ts GET when the InfiniteList sentinel scrolls
  // into view or the operator presses "Load more".
  const query: BookQuery = { size: "50" };
  const str = search.get("search");
  if (str) query.search = str;
  const bookType = search.get("bookType");
  if (bookType) query.bookType = bookType as BookQuery["bookType"];
  const libraryId = search.get("libraryId");
  if (libraryId) query.libraryId = libraryId;
  const sort = search.get("sort");
  if (sort) query.sort = sort as BookQuery["sort"];
  const direction = search.get("direction");
  if (direction) query.direction = direction as BookQuery["direction"];
  const page = search.get("page");
  if (page) query.page = page;
  const size = search.get("size");
  if (size) query.size = size;

  const { rpc } = locals;
  const res = await rpc.api.v1.books.$get({ query });
  if (!res.ok) throw error(res.status, "Failed to load books");
  const books = await res.json();

  return {
    books,
    filter: {
      search: search.get("search") ?? "",
      bookType: search.get("bookType") ?? "",
      libraryId: search.get("libraryId") ?? "",
      sort: search.get("sort") ?? "addedOn",
      direction: search.get("direction") ?? "desc",
    },
  };
};
