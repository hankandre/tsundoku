import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import { requireLogin } from "$lib/server/session";

export const load: PageServerLoad = async ({ locals, cookies, fetch, url }) => {
  requireLogin(locals, url.pathname);
  const { rpc } = locals;
  const res = await rpc.api.v1.notebook.$get();
  if (!res.ok) throw error(res.status, "Failed to load notebook");
  return { entries: await res.json() };
};

export const actions: Actions = {
  create: async ({ request, fetch, cookies, locals, url }) => {
    requireLogin(locals, url.pathname);
    const f = await request.formData();
    const title = String(f.get("title") ?? "").trim() || null;
    const content = String(f.get("content") ?? "").trim();
    const tagsRaw = String(f.get("tags") ?? "").trim();
    if (!content) return fail(400, { error: "Content required" });
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const { rpc } = locals;
    const res = await rpc.api.v1.notebook.$post({
      json: { title, content, tags, bookId: null },
    });
    if (!res.ok) return fail(res.status, { error: "Create failed" });
    return { ok: true };
  },
  delete: async ({ request, fetch, cookies, locals, url }) => {
    requireLogin(locals, url.pathname);
    const f = await request.formData();
    const id = String(f.get("id") ?? "");
    if (!id) return fail(400, { error: "Bad id" });
    const { rpc } = locals;
    const res = await rpc.api.v1.notebook[":id"].$delete({ param: { id } });
    if (!res.ok) return fail(res.status, { error: "Delete failed" });
    return { ok: true };
  },
};
