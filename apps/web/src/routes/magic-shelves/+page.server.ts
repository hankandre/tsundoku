import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { requireLogin } from "$lib/server/session";
import { EMPTY_RULES } from "$lib/magic-shelves/types";

export const load: PageServerLoad = async ({ locals, url }) => {
  requireLogin(locals, url.pathname);
  const { rpc } = locals;
  const res = await rpc.api.v1["magic-shelves"].$get();
  if (!res.ok) throw error(res.status, "Failed to load magic shelves");
  const shelves = await res.json();
  return { shelves };
};

export const actions: Actions = {
  create: async ({ request, locals, url }) => {
    requireLogin(locals, url.pathname);
    const data = await request.formData();
    const name = String(data.get("name") ?? "").trim();
    if (!name) return fail(400, { error: "Name is required" });

    const { rpc } = locals;
    const res = await rpc.api.v1["magic-shelves"].$post({
      json: { name, rules: EMPTY_RULES },
    });
    if (!res.ok) {
      // Unique-constraint collisions surface as 500 from the API for now;
      // pick a friendlier message for non-validation failures.
      const message =
        res.status >= 500 ? "A magic shelf with that name already exists" : "Create failed";
      return fail(res.status, { error: message });
    }
    const created = await res.json();
    // Land on the detail page so the user can start adding rules right away.
    throw redirect(303, `/magic-shelves/${created.id}`);
  },
  delete: async ({ request, locals, url }) => {
    requireLogin(locals, url.pathname);
    const data = await request.formData();
    const id = String(data.get("id") ?? "");
    if (!id) return fail(400, { error: "Bad id" });
    const { rpc } = locals;
    const res = await rpc.api.v1["magic-shelves"][":id"].$delete({ param: { id } });
    if (!res.ok) return fail(res.status, { error: "Delete failed" });
    return { ok: true };
  },
};
