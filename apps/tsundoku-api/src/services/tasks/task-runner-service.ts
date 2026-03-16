import { and, eq } from "drizzle-orm";
import { db, schema } from "../../db/client";
import { getAllLibraries } from "../library-service";
import { scanLibraryById } from "../discovery/library-discovery-service";
import { scanBookdropFolder } from "../discovery/bookdrop-scan-service";

type TaskOptions = {
  libraryId?: string;
  libraryPathId?: string;
  forceRefresh?: boolean;
  seriesName?: string;
};

const queuedTaskIds: string[] = [];
let queueRunning = false;

const ensureDb = () => {
  if (!db) {
    throw new Error("Database not configured");
  }
  return db;
};

export const parseTaskOptions = (raw: string | null): TaskOptions => {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      libraryId: typeof parsed.libraryId === "string" ? parsed.libraryId : undefined,
      libraryPathId: typeof parsed.libraryPathId === "string" ? parsed.libraryPathId : undefined,
      forceRefresh: typeof parsed.forceRefresh === "boolean" ? parsed.forceRefresh : undefined,
      seriesName: typeof parsed.seriesName === "string" ? parsed.seriesName : undefined,
    };
  } catch {
    return {};
  }
};

const setTaskRunning = async (taskId: string): Promise<void> => {
  const database = ensureDb();
  await database
    .update(schema.tasks)
    .set({
      status: "RUNNING",
      progressPercentage: 5,
      message: "Task execution started",
      updatedAt: new Date(),
    })
    .where(eq(schema.tasks.id, taskId));
};

const setTaskCompleted = async (taskId: string, message: string): Promise<void> => {
  const database = ensureDb();
  await database
    .update(schema.tasks)
    .set({
      status: "COMPLETED",
      progressPercentage: 100,
      message,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.tasks.id, taskId));
};

const setTaskFailed = async (taskId: string, message: string): Promise<void> => {
  const database = ensureDb();
  await database
    .update(schema.tasks)
    .set({
      status: "FAILED",
      message,
      errorDetails: message,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.tasks.id, taskId));
};

const runScanLibraryTask = async (taskId: string, taskOptions: TaskOptions, userId: string): Promise<void> => {
  const database = ensureDb();

  if (taskOptions.libraryId) {
    const summary = await scanLibraryById(taskOptions.libraryId, userId);
    await setTaskCompleted(
      taskId,
      `Library scan completed: scanned=${summary.scanned}, imported=${summary.imported}, skipped=${summary.skipped}, failed=${summary.failed}`,
    );
    return;
  }

  const libraries = await getAllLibraries();
  let scanned = 0;
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const library of libraries) {
    const summary = await scanLibraryById(library.id, userId);
    scanned += summary.scanned;
    imported += summary.imported;
    skipped += summary.skipped;
    failed += summary.failed;
  }

  await setTaskCompleted(
    taskId,
    `Library scan completed: scanned=${scanned}, imported=${imported}, skipped=${skipped}, failed=${failed}`,
  );

  await database
    .update(schema.tasks)
    .set({ progressPercentage: 100, updatedAt: new Date() })
    .where(eq(schema.tasks.id, taskId));
};

const runScanFilesTask = async (taskId: string, userId: string): Promise<void> => {
  const summary = await scanBookdropFolder(userId);
  await setTaskCompleted(
    taskId,
    `Bookdrop scan completed: scanned=${summary.scanned}, added=${summary.added}, skipped=${summary.skipped}`,
  );
};

const runTask = async (taskId: string): Promise<void> => {
  const database = ensureDb();

  const taskRows = await database
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.id, taskId))
    .limit(1);
  const task = taskRows[0];
  if (!task) {
    return;
  }

  if (task.status === "CANCELLED" || task.status === "COMPLETED") {
    return;
  }

  await setTaskRunning(taskId);

  const taskOptions = parseTaskOptions(task.taskOptions);
  try {
    if (task.type === "SCAN_LIBRARY") {
      await runScanLibraryTask(taskId, taskOptions, task.userId);
      return;
    }

    if (task.type === "SCAN_FILES") {
      await runScanFilesTask(taskId, task.userId);
      return;
    }

    await setTaskFailed(taskId, `Task type '${task.type}' is not executable yet`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Task execution failed";
    await setTaskFailed(taskId, message);
  }
};

const processQueue = async (): Promise<void> => {
  if (queueRunning) {
    return;
  }

  queueRunning = true;
  while (queuedTaskIds.length > 0) {
    const taskId = queuedTaskIds.shift();
    if (!taskId) {
      continue;
    }

    await runTask(taskId);
  }

  queueRunning = false;
};

export const enqueueTaskExecution = (taskId: string): void => {
  if (!queuedTaskIds.includes(taskId)) {
    queuedTaskIds.push(taskId);
  }
  void processQueue();
};

export const getTaskById = async (taskId: string) => {
  const database = ensureDb();
  const taskRows = await database
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.id, taskId))
    .limit(1);

  return taskRows[0] ?? null;
};

export const getActiveScanTaskForLibrary = async (libraryId: string) => {
  const database = ensureDb();

  const runningTasks = await database
    .select()
    .from(schema.tasks)
    .where(and(eq(schema.tasks.type, "SCAN_LIBRARY"), eq(schema.tasks.status, "RUNNING")));

  for (const task of runningTasks) {
    const options = parseTaskOptions(task.taskOptions);
    if (options.libraryId === libraryId) {
      return task;
    }
  }

  return null;
};
