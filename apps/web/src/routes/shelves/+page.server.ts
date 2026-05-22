import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import { requireLogin } from "$lib/server/session";

export const load: PageServerLoad = async ({ locals, url }) => {
  requireLogin(locals, url.pathname);
  const { rpc } = locals;
  const res = await rpc.api.v1.shelves.$get();
  if (!res.ok) throw error(res.status, "Failed to load shelves");
  return { shelves: await res.json() };
};

export const actions: Actions = {
  create: async ({ request, locals, url }) => {
    requireLogin(locals, url.pathname);
    const data = await request.formData();
    const name = String(data.get("name") ?? "").trim();
    if (!name) return fail(400, { error: "Name is required" });
    const { rpc } = locals;
    const res = await rpc.api.v1.shelves.$post({ json: { name } });
    if (!res.ok) return fail(res.status, { error: "Create failed" });
    return { ok: true };
  },
  delete: async ({ request, locals, url }) => {
    requireLogin(locals, url.pathname);
    const data = await request.formData();
    const id = String(data.get("id") ?? "");
    if (!id) return fail(400, { error: "Bad id" });
    const { rpc } = locals;
    const res = await rpc.api.v1.shelves[":id"].$delete({ param: { id } });
    if (!res.ok) return fail(res.status, { error: "Delete failed" });
    return { ok: true };
  },
};
