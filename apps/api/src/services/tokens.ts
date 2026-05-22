import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "../env.ts";

const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function secret() {
  if (!env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
  return new TextEncoder().encode(env.JWT_SECRET);
}

export type TokenClaims = JWTPayload & {
  username: string;
  isAdmin: boolean;
  permissions: string[];
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export async function issueTokens(input: {
  userId: string;
  username: string;
  isAdmin: boolean;
  permissions: string[];
}): Promise<TokenPair> {
  const now = Math.floor(Date.now() / 1000);
  const base: Partial<TokenClaims> = {
    sub: String(input.userId),
    username: input.username,
    isAdmin: input.isAdmin,
    permissions: input.permissions,
    iat: now,
  };

  const accessToken = await new SignJWT(base as TokenClaims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TTL_SECONDS)
    .setSubject(String(input.userId))
    .sign(secret());

  const refreshToken = await new SignJWT({ ...(base as TokenClaims), type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + REFRESH_TTL_SECONDS)
    .setSubject(String(input.userId))
    .sign(secret());

  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
}

export async function verifyToken(token: string): Promise<TokenClaims> {
  const { payload } = await jwtVerify(token, secret());
  return payload as TokenClaims;
}

export const TOKEN_TTL = { access: ACCESS_TTL_SECONDS, refresh: REFRESH_TTL_SECONDS };
