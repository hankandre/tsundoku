import { db, schema } from "../db/client";
import { eq, desc } from "drizzle-orm";
import { fail, assertIsDefined } from "../http/errors";

const ensureDb = () => {
  if (!db) {
    throw new Error("Database not configured");
  }
  return db;
};

export interface OidcGroupMappingRow {
  id: string;
  groupName: string;
  permissionAdmin: boolean | null;
  permissionManageLibrary: boolean | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export const getAllOidcGroupMappings = async (): Promise<OidcGroupMappingRow[]> => {
  const database = ensureDb();
  return database.select().from(schema.oidcGroupMapping);
};

export const createOidcGroupMapping = async (input: {
  groupName: string;
  permissionAdmin?: boolean;
  permissionManageLibrary?: boolean;
}): Promise<OidcGroupMappingRow> => {
  const database = ensureDb();
  
  const [created] = await database
    .insert(schema.oidcGroupMapping)
    .values({
      groupName: input.groupName,
      permissionAdmin: input.permissionAdmin ?? false,
      permissionManageLibrary: input.permissionManageLibrary ?? false,
    })
    .returning();
  
  return created;
};

export const updateOidcGroupMapping = async (
  id: string,
  input: {
    groupName?: string;
    permissionAdmin?: boolean;
    permissionManageLibrary?: boolean;
  }
): Promise<OidcGroupMappingRow> => {
  const database = ensureDb();
  
  const [updated] = await database
    .update(schema.oidcGroupMapping)
    .set({
      groupName: input.groupName,
      permissionAdmin: input.permissionAdmin,
      permissionManageLibrary: input.permissionManageLibrary,
      updatedAt: new Date(),
    })
    .where(eq(schema.oidcGroupMapping.id, id))
    .returning();
  
  if (!updated) {
    fail(404, "OIDC group mapping not found");
  }
  
  return updated;
};

export const deleteOidcGroupMapping = async (id: string): Promise<void> => {
  const database = ensureDb();
  await database.delete(schema.oidcGroupMapping).where(eq(schema.oidcGroupMapping.id, id));
};

export const getLatestOidcSession = async (userId: string) => {
  const database = ensureDb();
  
  const sessions = await database
    .select()
    .from(schema.oidcSession)
    .where(eq(schema.oidcSession.userId, userId))
    .orderBy(desc(schema.oidcSession.createdAt))
    .limit(1);
  
  return sessions[0] ?? null;
};

export const revokeOidcSession = async (sessionId: string): Promise<void> => {
  const database = ensureDb();
  await database
    .update(schema.oidcSession)
    .set({ revoked: true })
    .where(eq(schema.oidcSession.id, sessionId));
};

export const createOidcSession = async (input: {
  userId: string;
  oidcSubject: string;
  oidcIssuer: string;
  oidcSessionId?: string;
  idTokenHint?: string;
}): Promise<void> => {
  const database = ensureDb();
  await database.insert(schema.oidcSession).values({
    userId: input.userId,
    oidcSubject: input.oidcSubject,
    oidcIssuer: input.oidcIssuer,
    oidcSessionId: input.oidcSessionId,
    idTokenHint: input.idTokenHint,
    revoked: false,
  });
};
