import type { RequestHandler } from "./$types";
import { error, json } from "@sveltejs/kit";

/**
 * Thin proxy so the browser-side DirectoryPicker can hit the api's /fs/list
 * without needing the access token in client JS. The cookie is HTTP-only;
 * SvelteKit reads it here and forwards via Bearer.
 *
 *   GET /_internal/fs/list?path=/data&showHidden=true
 */
export const GET: RequestHandler = async ({ url, fetch, cookies, locals }) => {
  if (!locals.user) throw error(401, "Authentication required");
  const { rpc } = locals;
  const res = await rpc.api.v1.fs.list.$get({
    query: {
      path: url.searchParams.get("path") ?? undefined,
      showHidden: url.searchParams.get("showHidden") ?? undefined,
    },
  });
  if (!res.ok) throw error(res.status, await res.text().catch(() => "fs.list failed"));
  return json(await res.json());
};
