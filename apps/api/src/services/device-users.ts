import { eq, and } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";

/**
 * Device users are opaque (deviceType, label) credentials that map back to a
 * real `users.id`. Devices like KOReader, Kobo, and OPDS clients authenticate
 * with the issued token; the API resolves it to the underlying user.
 *
 * Tokens are stored as sha256 hashes — the plain value is only returned at
 * creation time so the operator can paste it into the device once.
 */

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function listDeviceUsers(userId: string) {
  const db = requireDb();
  return db
    .select({
      id: schema.deviceUsers.id,
      deviceType: schema.deviceUsers.deviceType,
      label: schema.deviceUsers.label,
      createdAt: schema.deviceUsers.createdAt,
      lastUsedAt: schema.deviceUsers.lastUsedAt,
    })
    .from(schema.deviceUsers)
    .where(eq(schema.deviceUsers.userId, userId));
}

export async function createDeviceUser(input: {
  userId: string;
  deviceType: "kobo" | "koreader" | "opds";
  label: string;
}): Promise<{ id: string; token: string }> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = sha256(token);
  const db = requireDb();
  const inserted = await db
    .insert(schema.deviceUsers)
    .values({ ...input, tokenHash })
    .returning({ id: schema.deviceUsers.id });
  return { id: inserted[0]!.id, token };
}

export async function deleteDeviceUser(userId: string, id: string): Promise<void> {
  const db = requireDb();
  await db
    .delete(schema.deviceUsers)
    .where(and(eq(schema.deviceUsers.id, id), eq(schema.deviceUsers.userId, userId)));
}

/**
 * Resolve a device-user token to the underlying app user. Updates lastUsedAt
 * on hit. Returns null if token doesn't match any device-user row.
 */
export async function authDeviceToken(
  token: string,
  deviceType: string,
): Promise<{ userId: string; deviceUserId: string } | null> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(schema.deviceUsers)
    .where(
      and(
        eq(schema.deviceUsers.tokenHash, sha256(token)),
        eq(schema.deviceUsers.deviceType, deviceType),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  await db
    .update(schema.deviceUsers)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.deviceUsers.id, row.id));
  return { userId: row.userId, deviceUserId: row.id };
}
