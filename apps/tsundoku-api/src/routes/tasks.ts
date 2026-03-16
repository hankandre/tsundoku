import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables, AuthUser } from "../types/app-variables";
import { fail, handleValidationError } from "../http/errors";
import {
  getAvailableTasks,
  createTask,
  cancelTask,
  getLatestTasksForEachType,
  updateTaskCronConfig,
} from "../services/task-service";
import { enqueueTaskExecution, getTaskById } from "../services/tasks/task-runner-service";

const getAuthUser = (c: import("hono").Context): AuthUser => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser as AuthUser;
};

const taskTypes = [
  "SCAN_LIBRARY",
  "SCAN_FILES",
  "METADATA_AUTO",
  "METADATA_CUSTOM",
  "REGENERATE_COVERS",
  "CONVERT_FORMAT",
] as const;

const createTaskSchema = z.object({
  type: z.enum(taskTypes),
  libraryId: z.string().optional(),
  libraryPathId: z.string().optional(),
  forceRefresh: z.boolean().optional(),
  seriesName: z.string().optional(),
});

const cronConfigSchema = z.object({
  cronExpression: z.string(),
  enabled: z.boolean(),
});

const taskTypeParamSchema = z.object({
  taskType: z.enum(taskTypes),
});

const taskIdParamSchema = z.object({
  taskId: z.string(),
});

const validateTaskType = zValidator("param", taskTypeParamSchema, handleValidationError);
const validateTaskId = zValidator("param", taskIdParamSchema, handleValidationError);

export const taskRoutes = new Hono<{ Variables: AppVariables }>();

taskRoutes.get("/", async (c) => {
  const tasks = await getAvailableTasks();
  return c.json(tasks, 200);
});

taskRoutes.post("/start", zValidator("json", createTaskSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const input = c.req.valid("json");

  const task = await createTask(input.type, authUser.userId, {
    libraryId: input.libraryId,
    libraryPathId: input.libraryPathId,
    forceRefresh: input.forceRefresh,
    seriesName: input.seriesName,
  });

  enqueueTaskExecution(task.id);

  return c.json({
    taskId: task.id,
    status: "ACCEPTED",
    message: "Task started",
  }, 202);
});

taskRoutes.delete("/:taskId/cancel", validateTaskId, async (c) => {
  const { taskId } = c.req.valid("param");
  
  const result = await cancelTask(taskId);
  
  return c.json({
    taskId,
    cancelled: result.cancelled,
  }, 200);
});

taskRoutes.get("/last", async (c) => {
  const tasks = await getLatestTasksForEachType();
  return c.json({ tasks }, 200);
});

taskRoutes.patch("/:taskType/cron", validateTaskType, zValidator("json", cronConfigSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const { taskType } = c.req.valid("param");
  const { cronExpression, enabled } = c.req.valid("json");

  const config = await updateTaskCronConfig(taskType, cronExpression, enabled, authUser.userId);

  return c.json({
    taskType: config.taskType,
    cronExpression: config.cronExpression,
    enabled: config.enabled,
  }, 200);
});
