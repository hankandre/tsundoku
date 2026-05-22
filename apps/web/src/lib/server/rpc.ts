import { hc } from "hono/client";
import type { AppType } from "@tsundoku/api/app";
import { PUBLIC_API_URL } from "$env/static/public";

/**
 * Per-request RPC client for SSR. Constructed once per request in
 * `hooks.server.ts` and stashed on `event.locals.rpc` — page loaders just
 * destructure `const { rpc } = locals` and call it.
 *
 * Per-request is the right pattern here (the community standard — see
 * bop.systems and the hono docs) because `event.fetch` differs per request,
 * carrying that request's cookies/IP/headers into the upstream call.
 */
export function makeServerClient(opts: { fetch: typeof fetch; accessToken?: string | null }) {
  const headers: Record<string, string> = {};
  if (opts.accessToken) headers["Authorization"] = `Bearer ${opts.accessToken}`;
  return hc<AppType>(PUBLIC_API_URL, {
    fetch: opts.fetch as typeof fetch,
    headers,
  });
}

export type ServerRpc = ReturnType<typeof makeServerClient>;
