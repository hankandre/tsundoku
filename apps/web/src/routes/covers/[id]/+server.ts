import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import { PUBLIC_API_URL } from "$env/static/public";
import { getAccessToken } from "$lib/server/session";


/**
 * Authenticated cover proxy. The browser hits /covers/<bookId>; we read the
 * httpOnly SK access cookie server-side, forward to the api with a Bearer
 * header, and stream the response back. Keeps the bearer out of the DOM.
 */
export const GET: RequestHandler = async ({ params, cookies, fetch }) => {
  const id = params.id;
  if (!id) throw error(400, "Bad id");
  const token = getAccessToken(cookies);
  if (!token) throw error(401, "Authentication required");

  const upstream = await fetch(`${PUBLIC_API_URL}/api/v1/books/${id}/cover`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (upstream.status === 404) throw error(404, "No cover");
  if (!upstream.ok) throw error(upstream.status, "Cover fetch failed");

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
};
