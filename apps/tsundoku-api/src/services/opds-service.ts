import { db } from "../db/client";
import { opdsUserV2 } from "../db/schema/opds";
import { eq } from "drizzle-orm";
import { fail } from "../http/errors";

type OpdsUserCreateInput = {
  username: string;
  password: string;
  sortOrder?: "title" | "author" | "last_modified" | "random";
};

type OpdsUserUpdateInput = {
  username?: string;
  sortOrder?: "title" | "author" | "last_modified" | "random";
};

type OpdsUserResponse = {
  id: string;
  userId: string;
  username: string;
  sortOrder: string;
  createdAt: Date;
  updatedAt: Date;
};

async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash);
}

export async function getOpdsUsers(): Promise<OpdsUserResponse[]> {
  const users = await db.select().from(opdsUserV2);
  return users.map((u) => ({
    id: u.id,
    userId: u.userId,
    username: u.username,
    sortOrder: u.sortOrder ?? "recent",
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }));
}

export async function getOpdsUserById(id: string): Promise<OpdsUserResponse | null> {
  const users = await db.select().from(opdsUserV2).where(eq(opdsUserV2.id, id));
  if (users.length === 0) {
    return null;
  }
  const u = users[0];
  return {
    id: u.id,
    userId: u.userId,
    username: u.username,
    sortOrder: u.sortOrder ?? "recent",
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export async function createOpdsUser(
  input: OpdsUserCreateInput,
  userId: string
): Promise<OpdsUserResponse> {
  const passwordHash = await hashPassword(input.password);

  const [created] = await db
    .insert(opdsUserV2)
    .values({
      userId,
      username: input.username,
      passwordHash,
      sortOrder: input.sortOrder ?? "recent",
    })
    .returning();

  return {
    id: created.id,
    userId: created.userId,
    username: created.username,
    sortOrder: created.sortOrder ?? "recent",
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

export async function deleteOpdsUser(id: string): Promise<void> {
  await db.delete(opdsUserV2).where(eq(opdsUserV2.id, id));
}

export async function updateOpdsUser(
  id: string,
  input: OpdsUserUpdateInput
): Promise<OpdsUserResponse> {
  const existing = await getOpdsUserById(id);
  if (!existing) {
    fail(404, "OPDS user not found");
    return {} as OpdsUserResponse;
  }

  const [updated] = await db
    .update(opdsUserV2)
    .set({
      username: input.username ?? existing.username,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(opdsUserV2.id, id))
    .returning();

  return {
    id: updated.id,
    userId: updated.userId,
    username: updated.username,
    sortOrder: updated.sortOrder ?? "recent",
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

export async function validateOpdsUser(
  username: string,
  password: string
): Promise<OpdsUserResponse | null> {
  const users = await db
    .select()
    .from(opdsUserV2)
    .where(eq(opdsUserV2.username, username));

  if (users.length === 0) {
    return null;
  }

  const user = users[0];
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  return {
    id: user.id,
    userId: user.userId,
    username: user.username,
    sortOrder: user.sortOrder ?? "recent",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
