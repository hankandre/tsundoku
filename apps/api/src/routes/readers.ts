import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { authOptional } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";
import { resolveBookFile, statFile } from "../services/files.ts";
import { verifyToken } from "../services/tokens.ts";
import {
  pdfPageCount,
  pdfToc,
  epubManifest,
  cbxPages,
  cbxPage,
} from "../services/reader-helpers.ts";
/**
 * Streaming endpoints honor HTTP Range so PDF.js / epub.js / audio players can
 * jump around without downloading the whole file. Auth tolerates the Booklore
 * convention of passing the JWT as a `?token=` query param for `<img>`/`<audio>`
 * tags that can't set headers.
 */

async function userFromQueryToken(token: string | undefined) {
  if (!token) return null;
  try {
    const claims = await verifyToken(token);
    return {
      id: String(claims.sub ?? ""),
      isAdmin: Boolean(claims.isAdmin),
    };
  } catch {
    return null;
  }
}

function rangeFromRequest(req: Request, total: number): { start: number; end: number } | null {
  const header = req.headers.get("Range");
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!m) return null;
  const startStr = m[1];
  const endStr = m[2];
  const start = startStr ? parseInt(startStr, 10) : 0;
  const end = endStr ? parseInt(endStr, 10) : total - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= total) return null;
  return { start, end };
}

async function streamFile(absPath: string, contentType: string, req: Request): Promise<Response> {
  const stat = await statFile(absPath);
  if (!stat) throw new HTTPException(404, { message: "File missing on disk" });
  const file = Bun.file(absPath);
  const range = rangeFromRequest(req, stat.size);
  const headers = new Headers({
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=0",
  });
  if (!range) {
    headers.set("Content-Length", String(stat.size));
    return new Response(file.stream(), { status: 200, headers });
  }
  const length = range.end - range.start + 1;
  headers.set("Content-Length", String(length));
  headers.set("Content-Range", `bytes ${range.start}-${range.end}/${stat.size}`);
  return new Response(file.slice(range.start, range.end + 1).stream(), {
    status: 206,
    headers,
  });
}

export const readerRoutes = new Hono()
  // Note: no global authRequired here — we resolve auth manually so that
  // query-param tokens work alongside Authorization headers.
  .use("*", authOptional)

  .get("/files/:id/stream", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const user = c.var.user
      ? { id: c.var.user.id, isAdmin: c.var.user.isAdmin }
      : await userFromQueryToken(c.req.query("token"));
    if (!user) throw new HTTPException(401, { message: "Authentication required" });

    const resolved = await resolveBookFile(id);
    if (!resolved) throw new HTTPException(404, { message: "Book not found" });

    // Phase 9 will tighten per-library/per-book ACLs; for now any authenticated
    // user can stream any book file (admin and content-restriction checks come
    // online with the library scan slice).
    return streamFile(resolved.absolutePath, resolved.contentType, c.req.raw);
  })

  // EPUB-specific helper: parse the OPF and return title + TOC + spine paths.
  // The browser-side reader can consume the spine list to render a custom UI
  // without re-parsing the whole zip client-side.
  .get("/files/:id/epub/manifest", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const m = await epubManifest(id);
    if (!m) throw new HTTPException(404, { message: "Not an EPUB or unreadable" });
    return c.json(m);
  })
  // PDF page count — useful so the UI can show "page X of N" before pdfjs-dist
  // finishes parsing client-side.
  .get("/files/:id/pdf/page-count", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const n = await pdfPageCount(id);
    if (n === null) throw new HTTPException(404, { message: "Not a PDF or unreadable" });
    return c.json({ pageCount: n });
  })
  .get("/files/:id/pdf/toc", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await pdfToc(id));
  })
  // CBX pages: list of page names + per-page streaming.
  .get("/files/:id/cbx/pages", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const pages = await cbxPages(id);
    if (!pages) throw new HTTPException(404, { message: "Not a CBX or unreadable" });
    return c.json({ pageCount: pages.length, pages });
  })
  .get(
    "/files/:id/cbx/page/:n",
    sValidator("param", IdParam),
    async (c) => {
      const { id } = c.req.valid("param");
      const n = Number(c.req.param("n"));
      if (!Number.isInteger(n) || n < 0)
        throw new HTTPException(400, { message: "Bad page index" });
      const res = await cbxPage(id, n);
      if (!res) throw new HTTPException(404, { message: "Page not found" });
      return res;
    },
  );
