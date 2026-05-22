import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { authRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";
import {
  readSidecars,
  importSidecars,
  exportSidecars,
} from "../services/sidecar.ts";

function requireEditMetadata(u: { isAdmin: boolean; permissions: string[] }) {
  if (!u.isAdmin && !u.permissions.includes("editMetadata")) {
    throw new HTTPException(403, { message: "Sidecar ops not permitted" });
  }
}

export const sidecarRoutes = new Hono()
  .use("*", authRequired)
  // What sidecars exist next to the book file?
  .get("/books/:id/sidecars", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const { cover, opf, metadataJson } = await readSidecars(id);
    return c.json({
      hasCover: !!cover,
      coverMime: cover?.mime ?? null,
      hasOpf: !!opf,
      hasMetadataJson: !!metadataJson,
      // Send the JSON content too so the client can preview.
      metadataJson: metadataJson ?? null,
    });
  })
  // Import: read sidecars + apply to the book row.
  .post("/books/:id/sidecars/import", sValidator("param", IdParam), async (c) => {
    requireEditMetadata(c.var.user!);
    const { id } = c.req.valid("param");
    return c.json(await importSidecars(id));
  })
  // Export: write the DB's view of the book back to disk as sidecars.
  .post("/books/:id/sidecars/export", sValidator("param", IdParam), async (c) => {
    requireEditMetadata(c.var.user!);
    const { id } = c.req.valid("param");
    return c.json(await exportSidecars(id));
  });
