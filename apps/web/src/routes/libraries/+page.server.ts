import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import { requireLogin } from "$lib/server/session";

export const load: PageServerLoad = async ({ locals, cookies, fetch, url }) => {
  requireLogin(locals, url.pathname);
  const { rpc } = locals;
  const res = await rpc.api.v1.libraries.$get();
  if (!res.ok) throw error(res.status, "Failed to load libraries");
  const libraries = await res.json();
  return { libraries };
};

const ORG_MODES = ["BOOK_PER_FILE", "BOOK_PER_DIRECTORY", "AUTO_DETECT"] as const;
type OrgMode = (typeof ORG_MODES)[number];

export const actions: Actions = {
  create: async ({ request, fetch, cookies, locals, url }) => {
    requireLogin(locals, url.pathname);
    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    const icon = String(form.get("icon") ?? "").trim() || undefined;
    const organizationMode = String(form.get("organizationMode") ?? "BOOK_PER_FILE") as OrgMode;
    // Paths arrive as repeated `paths` fields from the form.
    const paths = form
      .getAll("paths")
      .map((v) => String(v).trim())
      .filter((p) => p.length > 0);

    if (!name) return fail(400, { error: "Name is required", name });
    if (!ORG_MODES.includes(organizationMode)) {
      return fail(400, { error: "Bad organization mode", name });
    }
    const { rpc } = locals;
    const res = await rpc.api.v1.libraries.$post({
      json: { name, icon, organizationMode, paths },
    });
    if (!res.ok) return fail(res.status, { error: "Create failed", name });
    return { ok: true };
  },

  delete: async ({ request, fetch, cookies, locals, url }) => {
    requireLogin(locals, url.pathname);
    const form = await request.formData();
    const id = Number(form.get("id"));
    if (!Number.isInteger(id) || id < 1) return fail(400, { error: "Bad id" });
    const { rpc } = locals;
    const res = await rpc.api.v1.libraries[":id"].$delete({ param: { id: String(id) } });
    if (!res.ok) return fail(res.status, { error: "Delete failed" });
    return { ok: true };
  },
};
