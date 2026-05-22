import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { requireLogin, getAccessToken } from "$lib/server/session";

export const load: PageServerLoad = async ({ params, locals, cookies, url }) => {
  requireLogin(locals, url.pathname);
  const id = params.id;
  if (!id) throw error(400, "Bad book id");
  return {
    bookId: id,
    // Pass the access token to the page so the PDF viewer can include it as a
    // ?token= query param (PDF.js can't set custom headers on its fetch).
    accessToken: getAccessToken(cookies),
  };
};
