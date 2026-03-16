import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables, AuthUser } from "../types/app-variables";
import { fail, handleValidationError } from "../http/errors";
import {
  recordReadingSession,
  getReadingSessionsForBook,
} from "../services/reading-session-service";

const getAuthUser = (c: import("hono").Context): AuthUser => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser as AuthUser;
};

const readingSessionSchema = z.object({
  bookId: z.string(),
  bookType: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  durationSeconds: z.number().int().min(0),
  startProgress: z.number().int().min(0),
  endProgress: z.number().int().min(0),
  progressDelta: z.number().int(),
  startLocation: z.string(),
  endLocation: z.string(),
});

const bookIdParamSchema = z.object({
  bookId: z.uuidv7(),
});

const validateBookId = zValidator("param", bookIdParamSchema, handleValidationError);

export const readingSessionRoutes = new Hono<{ Variables: AppVariables }>();

readingSessionRoutes.post("/", zValidator("json", readingSessionSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const input = c.req.valid("json");

  await recordReadingSession({
    userId: authUser.userId,
    bookId: input.bookId,
    bookType: input.bookType,
    startTime: new Date(input.startTime),
    endTime: new Date(input.endTime),
    durationSeconds: input.durationSeconds,
    startProgress: input.startProgress,
    endProgress: input.endProgress,
    progressDelta: input.progressDelta,
    startLocation: input.startLocation,
    endLocation: input.endLocation,
  });

  return c.body(null, 202);
});

readingSessionRoutes.get("/book/:bookId", validateBookId, async (c) => {
  const authUser = getAuthUser(c);
  const { bookId } = c.req.valid("param");
  const page = parseInt(c.req.query("page") ?? "0");
  const size = parseInt(c.req.query("size") ?? "5");

  const result = await getReadingSessionsForBook(bookId, authUser.userId, page, Math.min(size, 100));

  return c.json({
    content: result.sessions,
    totalElements: result.total,
    totalPages: Math.ceil(result.total / size),
    number: page,
    size: size,
  }, 200);
});
