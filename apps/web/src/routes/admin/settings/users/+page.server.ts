import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import { requireLogin } from "$lib/server/session";

function requireAdmin(locals: App.Locals, path: string) {
  requireLogin(locals, path);
  if (!locals.user?.isAdmin) throw error(403, "Admin required");
}

export const load: PageServerLoad = async ({ locals, cookies, fetch, url }) => {
  requireAdmin(locals, url.pathname);
  const { rpc } = locals;
  const [usersRes, libsRes] = await Promise.all([
    rpc.api.v1.users.$get(),
    rpc.api.v1.libraries.$get(),
  ]);
  if (!usersRes.ok) throw error(usersRes.status, "Failed to load users");
  if (!libsRes.ok) throw error(libsRes.status, "Failed to load libraries");
  const users = await usersRes.json();
  const libraries = await libsRes.json();
  // Per-user library access. Skip admins (they get everything).
  const accessByUser: Record<string, string[]> = {};
  await Promise.all(
    users.map(async (u) => {
      if (u.permissions.admin) {
        accessByUser[u.id] = libraries.map((l) => l.id);
        return;
      }
      const r = await rpc.api.v1.users[":id"].libraries.$get({ param: { id: u.id } });
      if (r.ok) {
        const { libraryIds } = (await r.json()) as { libraryIds: string[] };
        accessByUser[u.id] = libraryIds;
      } else {
        accessByUser[u.id] = [];
      }
    }),
  );
  return { users, libraries, accessByUser };
};

export const actions: Actions = {
  create: async ({ request, fetch, cookies, locals, url }) => {
    requireAdmin(locals, url.pathname);
    const f = await request.formData();
    const username = String(f.get("username") ?? "").trim();
    const password = String(f.get("password") ?? "");
    const name = String(f.get("name") ?? "").trim() || undefined;
    const email = String(f.get("email") ?? "").trim() || undefined;
    const isAdmin = f.get("isAdmin") === "on";
    if (!username || password.length < 8)
      return fail(400, { error: "Username and ≥8-char password required" });
    const { rpc } = locals;
    const res = await rpc.api.v1.users.$post({
      json: { username, password, name, email, isAdmin },
    });
    if (!res.ok) return fail(res.status, { error: "Create failed" });
    return { ok: true };
  },

  updatePermissions: async ({ request, fetch, cookies, locals, url }) => {
    requireAdmin(locals, url.pathname);
    const f = await request.formData();
    const id = String(f.get("id") ?? "");
    if (!id) return fail(400, { error: "Bad id" });
    const perms = {
      upload: f.get("upload") === "on",
      download: f.get("download") === "on",
      editMetadata: f.get("editMetadata") === "on",
      manipulateLibrary: f.get("manipulateLibrary") === "on",
      admin: f.get("admin") === "on",
    };
    const { rpc } = locals;
    const res = await rpc.api.v1.users[":id"].permissions.$put({
      param: { id },
      json: perms,
    });
    if (!res.ok) return fail(res.status, { error: "Update failed" });
    return { ok: true };
  },

  setLibraries: async ({ request, fetch, cookies, locals, url }) => {
    requireAdmin(locals, url.pathname);
    const f = await request.formData();
    const id = String(f.get("id") ?? "");
    if (!id) return fail(400, { error: "Bad id" });
    const libraryIds = f.getAll("libraryIds").map((v) => String(v)).filter(Boolean);
    const { rpc } = locals;
    const res = await rpc.api.v1.users[":id"].libraries.$put({
      param: { id },
      json: { libraryIds },
    });
    if (!res.ok) return fail(res.status, { error: "Update failed" });
    return { ok: true };
  },

  delete: async ({ request, fetch, cookies, locals, url }) => {
    requireAdmin(locals, url.pathname);
    const f = await request.formData();
    const id = String(f.get("id") ?? "");
    if (!id) return fail(400, { error: "Bad id" });
    const { rpc } = locals;
    const res = await rpc.api.v1.users[":id"].$delete({ param: { id } });
    if (!res.ok) return fail(res.status, { error: "Delete failed" });
    return { ok: true };
  },
};
