import { db, schema } from "../db/client";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { fail, assertIsDefined } from "../http/errors";

export interface TaskRow {
  id: string;
  type: string;
  status: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date | null;
  completedAt: Date | null;
  progressPercentage: number | null;
  message: string | null;
  errorDetails: string | null;
  taskOptions: string | null;
}

export interface TaskCronRow {
  id: string;
  taskType: string;
  cronExpression: string;
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ensureDb = () => {
  if (!db) {
    throw new Error("Database not configured");
  }
  return db;
};

export const getAvailableTasks = async (): Promise<Array<{ type: string; name: string }>> => {
  const database = ensureDb();
  
  const taskTypes = [
    { type: "SCAN_LIBRARY", name: "Scan Library" },
    { type: "SCAN_FILES", name: "Scan Files" },
    { type: "METADATA_AUTO", name: "Auto Fetch Metadata" },
    { type: "METADATA_CUSTOM", name: "Custom Fetch Metadata" },
    { type: "REGENERATE_COVERS", name: "Regenerate Covers" },
    { type: "CONVERT_FORMAT", name: "Convert Format" },
  ];

  return taskTypes;
};

export const createTask = async (
  type: string,
  userId: string,
  taskOptions?: Record<string, unknown>
): Promise<TaskRow> => {
  const database = ensureDb();
  
  const taskId = Bun.randomUUIDv7();
  const optionsJson = taskOptions ? JSON.stringify(taskOptions) : null;
  
  await database.insert(schema.tasks).values({
    id: taskId,
    type,
    status: "PENDING",
    userId,
    taskOptions: optionsJson,
    createdBy: userId,
  });
  
  const result = await database.select().from(schema.tasks).where(eq(schema.tasks.id, taskId));
  return result[0] as TaskRow;
};

export const cancelTask = async (taskId: string): Promise<{ cancelled: boolean }> => {
  const database = ensureDb();
  
  const existing = await database.select().from(schema.tasks).where(eq(schema.tasks.id, taskId));
  if (!existing[0]) {
    return { cancelled: false };
  }
  
  await database
    .update(schema.tasks)
    .set({ status: "CANCELLED", updatedAt: new Date() })
    .where(eq(schema.tasks.id, taskId));
  
  return { cancelled: true };
};

export const getLatestTasksForEachType = async (): Promise<Record<string, TaskRow | null>> => {
  const database = ensureDb();
  
  const taskTypes = [
    "SCAN_LIBRARY",
    "SCAN_FILES",
    "METADATA_AUTO",
    "METADATA_CUSTOM",
    "REGENERATE_COVERS",
    "CONVERT_FORMAT",
  ];
  
  const result: Record<string, TaskRow | null> = {};
  
  for (const taskType of taskTypes) {
    const latest = await database
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.type, taskType))
      .orderBy(desc(schema.tasks.createdAt))
      .limit(1);
    
    result[taskType] = latest[0] ? latest[0] as TaskRow : null;
  }
  
  return result;
};

export const getTaskCronConfig = async (taskType: string): Promise<TaskCronRow | null> => {
  const database = ensureDb();
  
  const result = await database
    .select()
    .from(schema.taskCronConfiguration)
    .where(eq(schema.taskCronConfiguration.taskType, taskType));
  
  return result[0] ? result[0] as TaskCronRow : null;
};

export const updateTaskCronConfig = async (
  taskType: string,
  cronExpression: string,
  enabled: boolean,
  userId: string
): Promise<TaskCronRow> => {
  const database = ensureDb();
  
  const existing = await database
    .select()
    .from(schema.taskCronConfiguration)
    .where(eq(schema.taskCronConfiguration.taskType, taskType));
  
  if (existing[0]) {
    await database
      .update(schema.taskCronConfiguration)
      .set({ 
        cronExpression, 
        enabled, 
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(schema.taskCronConfiguration.taskType, taskType));
  } else {
    await database.insert(schema.taskCronConfiguration).values({
      taskType,
      cronExpression,
      enabled,
      createdBy: userId,
    });
  }
  
  const updated = await database
    .select()
    .from(schema.taskCronConfiguration)
    .where(eq(schema.taskCronConfiguration.taskType, taskType));
  
  return updated[0] as TaskCronRow;
};
