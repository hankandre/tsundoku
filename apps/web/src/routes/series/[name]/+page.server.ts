import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { requireLogin } from "$lib/server/session";

export const load: PageServerLoad = async ({ params, locals, cookies, fetch, url }) => {
  requireLogin(locals, url.pathname);
  const name = params.name;
  if (!name) throw error(400, "Bad series name");
  const { rpc } = locals;
  const res = await rpc.api.v1.series[":name"].$get({ param: { name } });
  if (res.status === 404) throw error(404, "Series not found");
  if (!res.ok) throw error(res.status, "Failed to load series");
  return { series: await res.json() };
};
