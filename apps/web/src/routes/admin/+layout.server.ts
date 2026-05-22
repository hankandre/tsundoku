import { error } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { requireLogin } from "$lib/server/session";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  requireLogin(locals, url.pathname);
  if (!locals.user?.isAdmin) throw error(403, "Admin required");
  return {};
};
