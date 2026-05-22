import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import { PUBLIC_API_URL } from "$env/static/public";
import { requireLogin, getAccessToken } from "$lib/server/session";


export const load: PageServerLoad = async ({ locals, cookies, fetch, url }) => {
  requireLogin(locals, url.pathname);
  const { rpc } = locals;
  const res = await rpc.api.v1.libraries.$get();
  if (!res.ok) throw error(res.status, "Failed to load libraries");
  const libraries = await res.json();
  return { libraries };
};

export const actions: Actions = {
  default: async ({ request, fetch, cookies, locals, url }) => {
    requireLogin(locals, url.pathname);
    const form = await request.formData();
    const libraryId = String(form.get("libraryId") ?? "");
    const file = form.get("file");
    if (!libraryId) return fail(400, { error: "Library is required" });
    if (!(file instanceof File) || file.size === 0)
      return fail(400, { error: "Pick a file to upload" });

    // Forward the multipart body to the api with the bearer header. We rebuild
    // the FormData so node-fetch / undici set the boundary correctly.
    const fwd = new FormData();
    fwd.set("file", file, file.name);
    const token = getAccessToken(cookies);
    const res = await fetch(`${PUBLIC_API_URL}/api/v1/libraries/${libraryId}/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fwd,
    });
    if (res.status === 413)
      return fail(413, { error: "File exceeds 1 GiB limit" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return fail(res.status, { error: `Upload failed (${res.status}): ${body || res.statusText}` });
    }
    const result = (await res.json()) as { id: string; fileName: string };
    return { ok: true, bookId: result.id, fileName: result.fileName };
  },
};
