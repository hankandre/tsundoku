import { and, eq, gt } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";

export async function storeRefreshToken(input: {
  userId: string;
  token: string;
  expiresAt: Date;
}) {
  const db = requireDb();
  await db.insert(schema.refreshTokens).values({
    userId: input.userId,
    token: input.token,
    expiryDate: input.expiresAt,
  });
}

export async function findActiveRefreshToken(token: string) {
  const db = requireDb();
  const rows = await db
    .select()
    .from(schema.refreshTokens)
    .where(
      and(
        eq(schema.refreshTokens.token, token),
        eq(schema.refreshTokens.revoked, false),
        gt(schema.refreshTokens.expiryDate, new Date()),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function revokeRefreshToken(token: string) {
  const db = requireDb();
  await db
    .update(schema.refreshTokens)
    .set({ revoked: true, revocationDate: new Date() })
    .where(eq(schema.refreshTokens.token, token));
}

export async function revokeAllForUser(userId: string) {
  const db = requireDb();
  await db
    .update(schema.refreshTokens)
    .set({ revoked: true, revocationDate: new Date() })
    .where(eq(schema.refreshTokens.userId, userId));
}
