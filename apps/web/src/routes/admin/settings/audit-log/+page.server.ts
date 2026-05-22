import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { requireLogin } from "$lib/server/session";

export const load: PageServerLoad = async ({ locals, cookies, fetch, url }) => {
  requireLogin(locals, url.pathname);
  if (!locals.user?.isAdmin) throw error(403, "Admin required");
  const limit = url.searchParams.get("limit") ?? "100";
  const { rpc } = locals;
  const res = await rpc.api.v1["audit-log"].$get({ query: { limit } });
  if (!res.ok) throw error(res.status, "Failed to load audit log");
  const entries = await res.json();
  return { entries, limit };
};
