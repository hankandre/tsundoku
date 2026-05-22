import { hc } from "hono/client";
import type { AppType } from "@tsundoku/api/app";

/**
 * Browser-side RPC client, cached as a singleton per page-load.
 *
 * The community pattern (see bop.systems, tolu.se) wraps `hc` in a `makeClient`
 * factory so the client is built once on first call and reused across SPA
 * navigation. We cache by access token so a sign-in / sign-out swap produces a
 * fresh client with the right Authorization header.
 *
 * For SSR / +page.server.ts use, prefer `event.locals.rpc` (set up in
 * `hooks.server.ts`). That client targets the API host directly and reuses
 * SvelteKit's per-request `event.fetch`.
 */

type BrowserRpc = ReturnType<typeof hc<AppType>>;

let cachedToken: string | null | undefined = undefined;
let cachedClient: BrowserRpc | null = null;

export function makeBrowserClient(accessToken?: string | null): BrowserRpc {
  if (cachedClient && cachedToken === accessToken) {
    return cachedClient;
  }
  const headers: Record<string, string> = {};
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  // Empty base URL → same-origin requests; dev's Vite proxy forwards `/api/*`
  // to the api host, prod's reverse proxy does the same.
  cachedClient = hc<AppType>("", { headers });
  cachedToken = accessToken;
  return cachedClient;
}
