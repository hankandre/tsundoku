import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { authRequired } from "../middleware/auth.ts";
import {
  listStagedFiles,
  removeStagedFile,
  finalizeStagedFile,
} from "../services/bookdrop.ts";

// Bookdrop file IDs are derived from `inode-size-mtime`, not UUIDs.
const StagedParam = type({ id: "string>0" });

const FinalizeBody = type({
  libraryId: "string.uuid",
});

export const bookdropRoutes = new Hono()
  .use("*", authRequired)
  .get("/bookdrop/files", async (c) => {
    return c.json(listStagedFiles());
  })
  .post(
    "/bookdrop/files/:id/finalize",
    sValidator("param", StagedParam),
    sValidator("json", FinalizeBody),
    async (c) => {
      const u = c.var.user!;
      if (!u.isAdmin && !u.permissions.includes("upload")) {
        throw new HTTPException(403, { message: "Bookdrop finalize not permitted" });
      }
      const { id } = c.req.valid("param");
      const { libraryId } = c.req.valid("json");
      const result = await finalizeStagedFile({ stagedId: id, libraryId });
      if ("error" in result) throw new HTTPException(400, { message: result.error });
      return c.json(result, 201);
    },
  )
  .delete(
    "/bookdrop/files/:id",
    sValidator("param", StagedParam),
    sValidator("query", type({ "delete?": "'true' | 'false'" })),
    async (c) => {
      const u = c.var.user!;
      if (!u.isAdmin && !u.permissions.includes("upload")) {
        throw new HTTPException(403, { message: "Bookdrop delete not permitted" });
      }
      const { id } = c.req.valid("param");
      const { delete: deleteFlag } = c.req.valid("query");
      const ok = await removeStagedFile(id, deleteFlag === "true");
      if (!ok) throw new HTTPException(404, { message: "Staged file not found" });
      return c.json({ ok: true });
    },
  );
