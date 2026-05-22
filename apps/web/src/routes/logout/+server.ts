import { redirect } from "@sveltejs/kit";
import { PUBLIC_API_URL } from "$env/static/public";
import { ACCESS_COOKIE } from "$lib/server/auth";
import type { RequestHandler } from "./$types";


export const POST: RequestHandler = async ({ fetch, cookies }) => {
  try {
    await fetch(`${PUBLIC_API_URL}/api/v1/auth/logout`, { method: "POST" });
  } catch {
    /* best effort */
  }
  cookies.delete(ACCESS_COOKIE, { path: "/" });
  throw redirect(303, "/login");
};

export const GET = POST;
