import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env";

const secret = new TextEncoder().encode(env.jwtSecret);

export type AccessClaims = {
  userId: string;
  isDefaultPassword: boolean;
};

const buildToken = async (subject: string, claims: AccessClaims, ttlMs: number): Promise<string> => {
  const now = Date.now();
  const expiresAt = now + ttlMs;

  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setJti(Bun.randomUUIDv7())
    .setIssuedAt(Math.floor(now / 1000))
    .setExpirationTime(Math.floor(expiresAt / 1000))
    .sign(secret);
};

export const issueAccessToken = (subject: string, claims: AccessClaims): Promise<string> =>
  buildToken(subject, claims, env.accessTokenTtlMs);

export const issueRefreshToken = (subject: string, claims: AccessClaims): Promise<string> =>
  buildToken(subject, claims, env.refreshTokenTtlMs);

export const verifyToken = async (token: string): Promise<{ sub: string; userId: string; isDefaultPassword: boolean }> => {
  const result = await jwtVerify(token, secret, {
    algorithms: ["HS256"],
  });

  const sub = result.payload.sub;
  const userId = result.payload.userId;
  const isDefaultPassword = result.payload.isDefaultPassword;

  if (typeof sub !== "string" || typeof userId !== "string" || typeof isDefaultPassword !== "boolean") {
    throw new Error("Invalid token claims");
  }

  return {
    sub,
    userId,
    isDefaultPassword,
  };
};
