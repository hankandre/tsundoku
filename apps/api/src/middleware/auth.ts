import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { jwtVerify, type JWTPayload } from "jose";
import { env } from "../env.ts";

export type AuthUser = {
  id: string;
  username: string;
  isAdmin: boolean;
  permissions: string[];
};

declare module "hono" {
  interface ContextVariableMap {
    // `user` is optional because authOptional may not populate it — readers
    // that depend on the user must check or run authRequired first. The Hono
    // docs warn against declaration-merging non-optional Variables (it lies
    // about middleware having run); optional is the honest shape.
    user?: AuthUser;
    // requestId is set unconditionally by the request-id middleware, which
    // runs on every request — non-optional here is honest.
    requestId: string;
  }
}

const secret = () => {
  if (!env.JWT_SECRET) {
    throw new HTTPException(500, {
      message: "JWT_SECRET is not configured.",
    });
  }
  return new TextEncoder().encode(env.JWT_SECRET);
};

function bearerFromHeader(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function userFromPayload(payload: JWTPayload): AuthUser {
  return {
    id: String(payload.sub ?? ""),
    username: String(payload["username"] ?? ""),
    isAdmin: Boolean(payload["isAdmin"] ?? false),
    permissions: Array.isArray(payload["permissions"])
      ? (payload["permissions"] as string[])
      : [],
  };
}

/** Populates c.var.user if a valid token is present; otherwise leaves it undefined. */
export const authOptional = createMiddleware(async (c, next) => {
  const token =
    bearerFromHeader(c.req.header("Authorization")) ??
    c.req.query("token") ?? // streaming endpoints pass JWT as a query param
    null;
  if (!token) return next();

  try {
    const { payload } = await jwtVerify(token, secret());
    c.set("user", userFromPayload(payload));
  } catch {
    // Invalid token — treat as unauthenticated for optional middleware.
  }
  return next();
});

/** Requires a valid bearer token; 401s otherwise. */
export const authRequired = createMiddleware(async (c, next) => {
  if (!c.var.user) {
    throw new HTTPException(401, { message: "Authentication required" });
  }
  return next();
});

/** Requires admin. Use after authRequired. */
export const adminRequired = createMiddleware(async (c, next) => {
  if (!c.var.user?.isAdmin) {
    throw new HTTPException(403, { message: "Admin privileges required" });
  }
  return next();
});
