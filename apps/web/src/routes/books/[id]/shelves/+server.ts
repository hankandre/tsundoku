import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireLogin } from "$lib/server/session";

// JSON sidecar for the inline ShelfPicker. Kept in SvelteKit (not browser→api
// direct) so the httpOnly access cookie stays on the server boundary.

export const GET: RequestHandler = async ({ locals, params, url }) => {
  requireLogin(locals, url.pathname);
  const id = params.id;
  if (!id) throw error(400, "Bad book id");
  const res = await locals.rpc.api.v1.books[":id"].shelves.$get({ param: { id } });
  if (!res.ok) throw error(res.status, "Failed to load book shelves");
  return json(await res.json());
};

export const PUT: RequestHandler = async ({ locals, params, request, url }) => {
  requireLogin(locals, url.pathname);
  const id = params.id;
  if (!id) throw error(400, "Bad book id");
  const body = (await request.json()) as { shelfIds?: string[] };
  const shelfIds = Array.isArray(body.shelfIds) ? body.shelfIds : [];
  const res = await locals.rpc.api.v1.books[":id"].shelves.$put({
    param: { id },
    json: { shelfIds },
  });
  if (!res.ok) throw error(res.status, "Failed to update shelves");
  return json(await res.json());
};
