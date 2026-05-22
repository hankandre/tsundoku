import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { requireLogin } from "$lib/server/session";

export const load: PageServerLoad = async ({ params, locals, cookies, fetch, url }) => {
  requireLogin(locals, url.pathname);
  const id = params.id;
  if (!id) throw error(400, "Bad shelf id");

  const { rpc } = locals;
  const res = await rpc.api.v1.books.$get({
    query: { shelfId: String(id), size: "100" },
  });
  if (!res.ok) throw error(res.status, "Failed to load books");
  const books = await res.json();

  return { shelfId: id, books };
};
