import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { requireLogin } from "$lib/server/session";
import { EMPTY_RULES, type GroupRule } from "$lib/magic-shelves/types";

export const load: PageServerLoad = async ({ params, locals, url }) => {
  requireLogin(locals, url.pathname);
  const { rpc } = locals;
  const id = params.id;
  if (!id) throw error(400, "Bad shelf id");

  const [shelfRes, booksRes] = await Promise.all([
    rpc.api.v1["magic-shelves"][":id"].$get({ param: { id } }),
    rpc.api.v1["magic-shelves"][":id"].books.$get({ param: { id }, query: { size: "50" } }),
  ]);
  if (shelfRes.status === 404) throw error(404, "Magic shelf not found");
  if (!shelfRes.ok) throw error(shelfRes.status, "Failed to load magic shelf");
  if (!booksRes.ok) throw error(booksRes.status, "Failed to load books");

  return {
    shelf: await shelfRes.json(),
    books: await booksRes.json(),
  };
};

export const actions: Actions = {
  save: async ({ params, request, locals, url }) => {
    requireLogin(locals, url.pathname);
    const id = params.id;
    if (!id) return fail(400, { error: "Bad id" });

    const data = await request.formData();
    const name = String(data.get("name") ?? "").trim();
    const rulesRaw = String(data.get("rules") ?? "");
    if (!name) return fail(400, { error: "Name is required" });
    let rules: GroupRule;
    try {
      // The rules payload is built client-side by the typed RuleBuilder and
      // serialized into a hidden field — never freehand JSON the user types.
      const parsed = JSON.parse(rulesRaw);
      rules = parsed && typeof parsed === "object" ? parsed : EMPTY_RULES;
    } catch {
      return fail(400, { error: "Rules payload was malformed" });
    }

    const { rpc } = locals;
    const res = await rpc.api.v1["magic-shelves"][":id"].$put({
      param: { id },
      json: { name, rules },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: unknown };
      const msg = typeof body.error === "string" ? body.error : "Save failed";
      return fail(res.status, { error: msg });
    }
    return { ok: true };
  },
  delete: async ({ params, locals, url }) => {
    requireLogin(locals, url.pathname);
    const id = params.id;
    if (!id) return fail(400, { error: "Bad id" });
    const { rpc } = locals;
    const res = await rpc.api.v1["magic-shelves"][":id"].$delete({ param: { id } });
    if (!res.ok) return fail(res.status, { error: "Delete failed" });
    throw redirect(303, "/magic-shelves");
  },
};
