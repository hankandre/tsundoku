import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { requireLogin } from "$lib/server/session";

export const load: PageServerLoad = async ({ params, locals, cookies, fetch, url }) => {
  requireLogin(locals, url.pathname);
  const id = params.id;
  if (!id) throw error(400, "Bad book id");

  const { rpc } = locals;
  const res = await rpc.api.v1.books[":id"].$get({ param: { id } });
  if (res.status === 404) throw error(404, "Book not found");
  if (!res.ok) throw error(res.status, "Failed to load book");
  const book = await res.json();

  return { book };
};
