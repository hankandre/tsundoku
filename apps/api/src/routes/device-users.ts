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
      if (e instanceof Error && /unique/i.test(e.message)) {
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
