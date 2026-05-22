import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { authRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";
import {
  listDeviceUsers,
  createDeviceUser,
  deleteDeviceUser,
} from "../services/device-users.ts";

const CreateBody = type({
  deviceType: "'kobo' | 'koreader' | 'opds'",
  label: "1 <= string <= 128",
});

function isUniqueViolation(error: unknown): boolean {
  let current = error;
  while (current && typeof current === "object") {
    const candidate = current as { code?: string; message?: string; cause?: unknown };
    if (candidate.code === "23505") return true;
    if (
      typeof candidate.message === "string" &&
      /(duplicate key|unique constraint|violates unique)/i.test(candidate.message)
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

export const deviceUserRoutes = new Hono()
  .use("*", authRequired)
  .get("/device-users", async (c) => {
    const u = c.var.user!;
    return c.json(await listDeviceUsers(u.id));
  })
  .post("/device-users", sValidator("json", CreateBody), async (c) => {
    const u = c.var.user!;
    const { deviceType, label } = c.req.valid("json");
    try {
      const result = await createDeviceUser({ userId: u.id, deviceType, label });
      return c.json(result, 201);
    } catch (e) {
      // Unique-violation on (userId, deviceType, label).
      if (isUniqueViolation(e)) {
        throw new HTTPException(409, {
          message: "A device with that label already exists",
        });
      }
      throw e;
    }
  })
  .delete("/device-users/:id", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    await deleteDeviceUser(u.id, id);
    return c.json({ ok: true });
  });
