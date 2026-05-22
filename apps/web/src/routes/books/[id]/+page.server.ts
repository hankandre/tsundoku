import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { requireLogin } from "$lib/server/session";

export const load: PageServerLoad = async ({ params, locals, cookies, fetch, url }) => {
  requireLogin(locals, url.pathname);
  const id = params.id;
  if (!id) throw error(400, "Bad book id");

  const { rpc } = locals;
  const [bookRes, shelvesRes, memberRes] = await Promise.all([
    rpc.api.v1.books[":id"].$get({ param: { id } }),
    rpc.api.v1.shelves.$get(),
    rpc.api.v1.books[":id"].shelves.$get({ param: { id } }),
  ]);
  if (bookRes.status === 404) throw error(404, "Book not found");
  if (!bookRes.ok) throw error(bookRes.status, "Failed to load book");

  const book = await bookRes.json();
  const shelves = shelvesRes.ok ? await shelvesRes.json() : [];
  const member = memberRes.ok ? await memberRes.json() : { shelfIds: [] };

  return { book, shelves, shelfIds: member.shelfIds };
};
