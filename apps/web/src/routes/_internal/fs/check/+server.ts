import type { RequestHandler } from "./$types";
import { error, json } from "@sveltejs/kit";

/**
 * Used by the DirectoryPicker to verify the api can write to a path before
 * the user saves it as a library path. Returns `{exists, isDir, writable}`.
 */
export const GET: RequestHandler = async ({ url, fetch, cookies, locals }) => {
  if (!locals.user) throw error(401, "Authentication required");
  const target = url.searchParams.get("path");
  if (!target) throw error(400, "Missing ?path");
  const { rpc } = locals;
  const res = await rpc.api.v1.fs.check.$get({ query: { path: target } });
  if (!res.ok) throw error(res.status, await res.text().catch(() => "fs.check failed"));
  return json(await res.json());
};
