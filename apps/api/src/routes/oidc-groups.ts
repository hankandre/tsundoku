import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { eq } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { authRequired, adminRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";

const MappingBody = type({
  groupName: "1 <= string <= 256",
  "isAdmin?": "boolean",
  "permissions?": "string[]",
  "libraryIds?": "string.uuid[]",
});

export const oidcGroupRoutes = new Hono()
  .use("*", authRequired, adminRequired)
  .get("/oidc/group-mappings", async (c) => {
    const db = requireDb();
    return c.json(await db.select().from(schema.oidcGroupMappings));
  })
  .post("/oidc/group-mappings", sValidator("json", MappingBody), async (c) => {
    const body = c.req.valid("json");
    const db = requireDb();
    const inserted = await db
      .insert(schema.oidcGroupMappings)
      .values({
        groupName: body.groupName,
        isAdmin: body.isAdmin ?? false,
        permissions: body.permissions ?? [],
        libraryIds: body.libraryIds ?? [],
      })
      .returning();
    return c.json(inserted[0], 201);
  })
  .put(
    "/oidc/group-mappings/:id",
    sValidator("param", IdParam),
    sValidator("json", MappingBody),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const db = requireDb();
      const result = await db
        .update(schema.oidcGroupMappings)
        .set({
          groupName: body.groupName,
          isAdmin: body.isAdmin ?? false,
          permissions: body.permissions,
          libraryIds: body.libraryIds,
        })
        .where(eq(schema.oidcGroupMappings.id, id))
        .returning({ id: schema.oidcGroupMappings.id });
      if (result.length === 0)
        throw new HTTPException(404, { message: "Mapping not found" });
      return c.json({ ok: true });
    },
  )
  .delete("/oidc/group-mappings/:id", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const db = requireDb();
    const result = await db
      .delete(schema.oidcGroupMappings)
      .where(eq(schema.oidcGroupMappings.id, id))
      .returning({ id: schema.oidcGroupMappings.id });
    if (result.length === 0)
      throw new HTTPException(404, { message: "Mapping not found" });
    return c.json({ ok: true });
  });
