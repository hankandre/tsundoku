import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireLogin } from "$lib/server/session";

// Client-side companion to /shelves and the inline ShelfPicker. Kept under
// _internal because the public /shelves route owns the page + form actions
// and a route can't be both a page and an endpoint.

export const GET: RequestHandler = async ({ locals, url }) => {
  requireLogin(locals, url.pathname);
  const res = await locals.rpc.api.v1.shelves.$get();
  if (!res.ok) throw error(res.status, "Failed to load shelves");
  return json(await res.json());
};

export const POST: RequestHandler = async ({ locals, request, url }) => {
  requireLogin(locals, url.pathname);
  const body = (await request.json()) as { name?: string; icon?: string | null };
  const name = String(body.name ?? "").trim();
  if (!name) throw error(400, "Name is required");
  const res = await locals.rpc.api.v1.shelves.$post({
    json: { name, ...(body.icon ? { icon: body.icon } : {}) },
  });
  if (!res.ok) throw error(res.status, "Failed to create shelf");
  return json(await res.json(), { status: 201 });
};
