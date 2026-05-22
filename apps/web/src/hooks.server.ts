import type { Handle } from "@sveltejs/kit";
import { verifyAccessToken, ACCESS_COOKIE } from "$lib/server/auth";
import { makeServerClient } from "$lib/server/rpc";

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get(ACCESS_COOKIE);
  event.locals.user = token ? await verifyAccessToken(token) : null;
  // One RPC client per request, available as `locals.rpc` everywhere. Carries
  // SvelteKit's `event.fetch` so upstream calls preserve request context, and
  // the bearer token for authenticated endpoints.
  event.locals.rpc = makeServerClient({ fetch: event.fetch, accessToken: token ?? null });
  return resolve(event);
};
