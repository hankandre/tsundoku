import { jwtVerify } from "jose";
import { env } from "$env/dynamic/private";

export type SessionUser = {
  id: string;
  username: string;
  isAdmin: boolean;
  permissions: string[];
};

let cachedSecret: Uint8Array | null = null;
let warnedMissingSecret = false;
function secret(): Uint8Array | null {
  if (!env["JWT_SECRET"]) {
    if (!warnedMissingSecret) {
      // Surface once per process — the silent return-null below would
      // otherwise look like "every login fails" with no signal.
      console.warn(
        "[auth] JWT_SECRET is not set in the web env — access tokens cannot be verified, so every page will treat the user as logged out. Set JWT_SECRET to the same value the API uses.",
      );
      warnedMissingSecret = true;
    }
    return null;
  }
  if (!cachedSecret) cachedSecret = new TextEncoder().encode(env["JWT_SECRET"]);
  return cachedSecret;
}

export async function verifyAccessToken(token: string): Promise<SessionUser | null> {
  const s = secret();
  if (!s) return null;
  try {
    const { payload } = await jwtVerify(token, s);
    return {
      id: String(payload.sub ?? ""),
      username: String(payload["username"] ?? ""),
      isAdmin: Boolean(payload["isAdmin"] ?? false),
      permissions: Array.isArray(payload["permissions"])
        ? (payload["permissions"] as string[])
        : [],
    };
  } catch {
    return null;
  }
}

export const ACCESS_COOKIE = "tsundoku_access";
