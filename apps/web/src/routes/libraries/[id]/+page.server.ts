import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { requireLogin, getAccessToken } from "$lib/server/session";

const ORG_MODES = ["BOOK_PER_FILE", "BOOK_PER_DIRECTORY", "AUTO_DETECT"] as const;
type OrgMode = (typeof ORG_MODES)[number];

export const load: PageServerLoad = async ({ params, locals, cookies, fetch, url }) => {
  requireLogin(locals, url.pathname);
  const id = params.id;
  if (!id) throw error(400, "Bad library id");

  const { rpc } = locals;

  const libRes = await rpc.api.v1.libraries[":id"].$get({ param: { id } });
  if (libRes.status === 404) throw error(404, "Library not found");
  if (!libRes.ok) throw error(libRes.status, "Failed to load library");
  const library = await libRes.json();

  const booksRes = await rpc.api.v1.books.$get({
    query: { libraryId: id, size: "50" },
  });
  if (!booksRes.ok) throw error(booksRes.status, "Failed to load books");
  const books = await booksRes.json();

  return { library, books, accessToken: getAccessToken(cookies) };
};

export const actions: Actions = {
  update: async ({ request, params, fetch, cookies, locals, url }) => {
    requireLogin(locals, url.pathname);
    const id = params.id;
    if (!id) return fail(400, { error: "Bad id" });

    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    const organizationMode = String(form.get("organizationMode") ?? "") as OrgMode;
    if (!name) return fail(400, { error: "Name is required" });
    if (!ORG_MODES.includes(organizationMode)) {
      return fail(400, { error: "Bad organization mode" });
    }

    const { rpc } = locals;
    const res = await rpc.api.v1.libraries[":id"].$patch({
      param: { id },
      json: { name, organizationMode },
    });
    if (!res.ok) return fail(res.status, { error: "Update failed" });
    return { ok: true };
  },

  addPath: async ({ request, params, fetch, cookies, locals, url }) => {
    requireLogin(locals, url.pathname);
    const id = params.id;
    if (!id) return fail(400, { error: "Bad id" });
    const form = await request.formData();
    const path = String(form.get("path") ?? "").trim();
    if (!path) return fail(400, { error: "Path is required" });

    const { rpc } = locals;
    const res = await rpc.api.v1.libraries[":id"].paths.$post({
      param: { id },
      json: { path },
    });
    if (!res.ok) return fail(res.status, { error: "Failed to add path" });
    return { ok: true };
  },

  removePath: async ({ request, params, fetch, cookies, locals, url }) => {
    requireLogin(locals, url.pathname);
    const id = params.id;
    if (!id) return fail(400, { error: "Bad id" });
    const form = await request.formData();
    const pathId = String(form.get("pathId") ?? "");
    if (!pathId) return fail(400, { error: "Bad path id" });

    const { rpc } = locals;
    const res = await rpc.api.v1.libraries[":id"].paths[":pathId"].$delete({
      param: { id, pathId },
    });
    if (!res.ok) return fail(res.status, { error: "Failed to remove path" });
    return { ok: true };
  },

  scan: async ({ params, fetch, cookies, locals, url }) => {
    requireLogin(locals, url.pathname);
    const id = params.id;
    if (!id) return fail(400, { error: "Bad id" });
    const { rpc } = locals;
    const res = await rpc.api.v1.libraries[":id"].scan.$post({ param: { id } });
    if (!res.ok) return fail(res.status, { error: "Scan failed to start" });
    const { taskId } = (await res.json()) as { taskId: string };
    return { ok: true, taskId };
  },

  delete: async ({ params, fetch, cookies, locals, url }) => {
    requireLogin(locals, url.pathname);
    const id = params.id;
    if (!id) return fail(400, { error: "Bad id" });
    const { rpc } = locals;
    const res = await rpc.api.v1.libraries[":id"].$delete({ param: { id } });
    if (!res.ok) return fail(res.status, { error: "Delete failed" });
    throw redirect(303, "/libraries");
  },
};
