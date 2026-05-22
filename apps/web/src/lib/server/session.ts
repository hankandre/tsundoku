import { redirect } from "@sveltejs/kit";
import { ACCESS_COOKIE } from "$lib/server/auth";
import type { Cookies } from "@sveltejs/kit";

export function requireLogin(locals: App.Locals, path: string): void {
  if (!locals.user) throw redirect(303, `/login?next=${encodeURIComponent(path)}`);
}

export function getAccessToken(cookies: Cookies): string | null {
  return cookies.get(ACCESS_COOKIE) ?? null;
}
