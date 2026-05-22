import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { requireLogin } from "$lib/server/session";

export const load: PageServerLoad = async ({ locals, cookies, fetch, url }) => {
  requireLogin(locals, url.pathname);
  const { rpc } = locals;
  const res = await rpc.api.v1.authors.$get();
  if (!res.ok) throw error(res.status, "Failed to load authors");
  return { authors: await res.json() };
};
