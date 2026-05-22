import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { requireLogin } from "$lib/server/session";

export const load: PageServerLoad = async ({ params, locals, url }) => {
  requireLogin(locals, url.pathname);
  const id = params.id;
  if (!id) throw error(400, "Bad shelf id");

  const { rpc } = locals;
  const [shelfRes, booksRes] = await Promise.all([
    rpc.api.v1.shelves[":id"].$get({ param: { id } }),
    rpc.api.v1.books.$get({ query: { shelfId: String(id), size: "100" } }),
  ]);
  if (shelfRes.status === 404) throw error(404, "Shelf not found");
  if (!shelfRes.ok) throw error(shelfRes.status, "Failed to load shelf");
  if (!booksRes.ok) throw error(booksRes.status, "Failed to load books");

  return {
    shelf: await shelfRes.json(),
    books: await booksRes.json(),
  };
};
