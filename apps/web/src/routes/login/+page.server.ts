import { fail, isRedirect, redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { PUBLIC_API_URL } from "$env/static/public";
import { ACCESS_COOKIE } from "$lib/server/auth";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, fetch }) => {
  if (locals.user) throw redirect(303, "/");

  // First-run bootstrap: if no users exist yet, send the operator through the
  // /setup flow to create the initial admin account.
  try {
    const res = await fetch(`${PUBLIC_API_URL}/api/v1/auth/setup-status`);
    if (res.ok) {
      const { needsSetup } = (await res.json()) as { needsSetup: boolean };
      if (needsSetup) throw redirect(303, "/setup");
    }
  } catch (err) {
    if (isRedirect(err)) throw err;
    // Swallow only the unreachable-API case so the login form still renders.
  }

  let oidcEnabled = false;
  try {
    const res = await fetch(`${PUBLIC_API_URL}/api/v1/auth/oidc/status`);
    if (res.ok) oidcEnabled = (await res.json()).enabled === true;
  } catch {
    // ignore — login form still works without OIDC button
  }
  return { oidcEnabled };
};

export const actions: Actions = {
  default: async ({ request, fetch, cookies }) => {
    const form = await request.formData();
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!username || !password) {
      return fail(400, { username, error: "Username and password are required" });
    }

    const res = await fetch(`${PUBLIC_API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      return fail(res.status, { username, error: "Invalid credentials" });
    }
    const { accessToken, expiresIn } = (await res.json()) as {
      accessToken: string;
      expiresIn: number;
    };
    cookies.set(ACCESS_COOKIE, accessToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: env["NODE_ENV"] === "production",
      maxAge: expiresIn,
    });
    throw redirect(303, "/");
  },
};
