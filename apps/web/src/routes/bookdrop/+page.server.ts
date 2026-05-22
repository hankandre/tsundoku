import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import { requireLogin } from "$lib/server/session";

export const load: PageServerLoad = async ({ locals, cookies, fetch, url }) => {
  requireLogin(locals, url.pathname);
  const { rpc } = locals;
  const [filesRes, libsRes] = await Promise.all([
    rpc.api.v1.bookdrop.files.$get(),
    rpc.api.v1.libraries.$get(),
  ]);
  if (!filesRes.ok) throw error(filesRes.status, "Failed to load staged files");
  if (!libsRes.ok) throw error(libsRes.status, "Failed to load libraries");
  return {
    files: await filesRes.json(),
    libraries: await libsRes.json(),
  };
};

export const actions: Actions = {
  finalize: async ({ request, fetch, cookies, locals, url }) => {
    requireLogin(locals, url.pathname);
    const f = await request.formData();
    const id = String(f.get("id") ?? "");
    const libraryId = String(f.get("libraryId") ?? "");
    if (!id || !libraryId) return fail(400, { error: "Bad form" });
    const { rpc } = locals;
    const res = await rpc.api.v1.bookdrop.files[":id"].finalize.$post({
      param: { id },
      json: { libraryId },
    });
    if (!res.ok) return fail(res.status, { error: "Finalize failed" });
    return { ok: true };
  },
  delete: async ({ request, fetch, cookies, locals, url }) => {
    requireLogin(locals, url.pathname);
    const f = await request.formData();
    const id = String(f.get("id") ?? "");
    if (!id) return fail(400, { error: "Bad id" });
    const { rpc } = locals;
    const res = await rpc.api.v1.bookdrop.files[":id"].$delete({
      param: { id },
      query: { delete: "true" },
    });
    if (!res.ok) return fail(res.status, { error: "Delete failed" });
    return { ok: true };
  },
};
