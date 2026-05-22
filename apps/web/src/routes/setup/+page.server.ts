import { fail, redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { PUBLIC_API_URL } from "$env/static/public";
import { ACCESS_COOKIE } from "$lib/server/auth";
import type { Actions, PageServerLoad } from "./$types";


export const load: PageServerLoad = async ({ fetch, locals }) => {
  if (locals.user) throw redirect(303, "/");
  // If setup is already done, this page should not be reachable.
  const res = await fetch(`${PUBLIC_API_URL}/api/v1/auth/setup-status`);
  if (res.ok) {
    const { needsSetup } = (await res.json()) as { needsSetup: boolean };
    if (!needsSetup) throw redirect(303, "/login");
  }
  return {};
};

export const actions: Actions = {
  default: async ({ request, fetch, cookies }) => {
    const form = await request.formData();
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    const name = String(form.get("name") ?? "").trim() || undefined;
    const email = String(form.get("email") ?? "").trim() || undefined;

    if (!username || !password) {
      return fail(400, { username, name, email, error: "Username and password are required" });
    }
    if (password.length < 8) {
      return fail(400, { username, name, email, error: "Password must be at least 8 characters" });
    }
    if (password !== confirm) {
      return fail(400, { username, name, email, error: "Passwords do not match" });
    }

    const res = await fetch(`${PUBLIC_API_URL}/api/v1/auth/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, name, email }),
    });
    if (res.status === 409) {
      // Someone else completed setup between page-load and submit. Send them
      // to /login rather than show a confusing error.
      throw redirect(303, "/login");
    }
    if (!res.ok) {
      return fail(res.status, { username, name, email, error: "Failed to create admin account" });
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
