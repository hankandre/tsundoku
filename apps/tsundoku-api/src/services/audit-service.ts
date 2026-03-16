import { db, schema } from "../db/client";
import { eq, and, ilike, gte, lte, desc, asc, sql } from "drizzle-orm";

export interface AuditLogRow {
  id: string;
  userId: string | null;
  username: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  description: string;
  ipAddress: string | null;
  countryCode: string | null;
  createdAt: Date;
}

const ensureDb = () => {
  if (!db) {
    throw new Error("Database not configured");
  }
  return db;
};

export interface GetAuditLogsParams {
  page: number;
  size: number;
  action?: string;
  userId?: string;
  username?: string;
  from?: Date;
  to?: Date;
}

export const getAuditLogs = async (params: GetAuditLogsParams): Promise<{ logs: AuditLogRow[]; total: number }> => {
  const database = ensureDb();
  
  const conditions: any[] = [];
  
  if (params.action) {
    conditions.push(eq(schema.auditLog.action, params.action));
  }
  if (params.userId) {
    conditions.push(eq(schema.auditLog.userId, params.userId));
  }
  if (params.username) {
    conditions.push(ilike(schema.auditLog.username, `%${params.username}%`));
  }
  if (params.from) {
    conditions.push(gte(schema.auditLog.createdAt, params.from));
  }
  if (params.to) {
    conditions.push(lte(schema.auditLog.createdAt, params.to));
  }
  
  const logs = await database
    .select()
    .from(schema.auditLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(params.size)
    .offset(params.page * params.size);
  
  const countResult = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.auditLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  
  return {
    logs: logs as AuditLogRow[],
    total: countResult[0]?.count ?? 0,
  };
};

export const getDistinctUsernames = async (): Promise<string[]> => {
  const database = ensureDb();
  
  const result = await database
    .selectDistinct({ username: schema.auditLog.username })
    .from(schema.auditLog)
    .orderBy(asc(schema.auditLog.username));
  
  return result.map(r => r.username);
};

export const createAuditLog = async (input: {
  userId?: string;
  username: string;
  action: string;
  entityType?: string;
  entityId?: string;
  description: string;
  ipAddress?: string;
  countryCode?: string;
}): Promise<AuditLogRow> => {
  const database = ensureDb();
  
  const logId = Bun.randomUUIDv7();
  
  await database.insert(schema.auditLog).values({
    id: logId,
    userId: input.userId ?? null,
    username: input.username,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    description: input.description,
    ipAddress: input.ipAddress ?? null,
    countryCode: input.countryCode ?? null,
    createdBy: input.userId,
  });
  
  const result = await database.select().from(schema.auditLog).where(eq(schema.auditLog.id, logId));
  return result[0] as AuditLogRow;
};
