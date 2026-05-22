import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { authRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";
import {
  listShelves,
  getShelf,
  createShelf,
  deleteShelf,
  setShelfBooks,
  assignBookToShelves,
  getShelfBookIds,
  getBookShelfIds,
  listMagicShelves,
  getMagicShelf,
  createMagicShelf,
  updateMagicShelf,
  deleteMagicShelf,
} from "../services/shelves.ts";
import { listBooks } from "../services/books.ts";
import { MagicShelfRulesType } from "../services/magic-shelf-rules.ts";

const CreateShelfBody = type({
  name: "1 <= string <= 256",
  "icon?": "string <= 128",
});

const SetBooksBody = type({
  "bookIds?": "string.uuid[]",
});

const AssignBookBody = type({
  "shelfIds?": "string.uuid[]",
});

const CreateMagicShelfBody = type({
  name: "1 <= string <= 256",
  "icon?": "(string <= 128) | null",
  "isPublic?": "boolean",
  "rules?": MagicShelfRulesType,
});

const UpdateMagicShelfBody = type({
  "name?": "1 <= string <= 256",
  "icon?": "(string <= 128) | null",
  "isPublic?": "boolean",
  "rules?": MagicShelfRulesType,
});

const MagicShelfBooksQuery = type({
  "page?": type("string.integer.parse").to("number >= 0"),
  "size?": type("string.integer.parse").to("1 <= number <= 100"),
  "sort?": "'addedOn' | 'title' | 'rating' | 'pageCount'",
  "direction?": "'asc' | 'desc'",
});

const PreviewBody = type({
  rules: MagicShelfRulesType,
  "size?": "1 <= number <= 50",
});

export const shelfRoutes = new Hono()
  .use("*", authRequired)
  .get("/shelves", async (c) => {
    const u = c.var.user!;
    const shelves = await listShelves(u.id);
    return c.json(shelves);
  })
  .post("/shelves", sValidator("json", CreateShelfBody), async (c) => {
    const u = c.var.user!;
    const shelf = await createShelf({ userId: u.id, ...c.req.valid("json") });
    return c.json(shelf, 201);
  })
  .get("/shelves/:id", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    const shelf = await getShelf(u.id, id);
    if (!shelf) throw new HTTPException(404, { message: "Shelf not found" });
    return c.json(shelf);
  })
  .delete("/shelves/:id", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    await deleteShelf(u.id, id);
    return c.json({ ok: true });
  })
  .get("/shelves/:id/books", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    const bookIds = await getShelfBookIds(u.id, id);
    return c.json({ bookIds });
  })
  .put(
    "/shelves/:id/books",
    sValidator("param", IdParam),
    sValidator("json", SetBooksBody),
    async (c) => {
      const u = c.var.user!;
      const { id } = c.req.valid("param");
      await setShelfBooks(u.id, id, c.req.valid("json").bookIds ?? []);
      return c.json({ ok: true });
    },
  )
  .get("/books/:id/shelves", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id: bookId } = c.req.valid("param");
    const shelfIds = await getBookShelfIds(u.id, bookId);
    return c.json({ shelfIds });
  })
  .put(
    "/books/:id/shelves",
    sValidator("param", IdParam),
    sValidator("json", AssignBookBody),
    async (c) => {
      const u = c.var.user!;
      const { id: bookId } = c.req.valid("param");
      await assignBookToShelves(u.id, bookId, c.req.valid("json").shelfIds ?? []);
      return c.json({ ok: true });
    },
  )
  .get("/magic-shelves", async (c) => {
    const u = c.var.user!;
    return c.json(await listMagicShelves(u.id));
  })
  .post("/magic-shelves", sValidator("json", CreateMagicShelfBody), async (c) => {
    const u = c.var.user!;
    const body = c.req.valid("json");
    const created = await createMagicShelf({
      userId: u.id,
      name: body.name,
      icon: body.icon ?? null,
      isPublic: body.isPublic,
      rules: body.rules,
    });
    return c.json(created, 201);
  })
  .post("/magic-shelves/preview", sValidator("json", PreviewBody), async (c) => {
    // Live preview for the rule builder. Takes an in-flight rule tree (not a
    // saved shelf id) and runs it through listBooks for the requester. Auth +
    // library scoping + content restrictions all flow through that one path.
    const u = c.var.user!;
    const { rules, size } = c.req.valid("json");
    const result = await listBooks(u.id, u.isAdmin, {
      magicShelfRules: rules,
      size: size ?? 6,
    });
    return c.json(result);
  })
  .get("/magic-shelves/:id", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    const shelf = await getMagicShelf(u.id, id);
    if (!shelf) throw new HTTPException(404, { message: "Magic shelf not found" });
    return c.json(shelf);
  })
  .put(
    "/magic-shelves/:id",
    sValidator("param", IdParam),
    sValidator("json", UpdateMagicShelfBody),
    async (c) => {
      const u = c.var.user!;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const updated = await updateMagicShelf(u.id, id, {
        name: body.name,
        icon: body.icon,
        isPublic: body.isPublic,
        rules: body.rules,
      });
      if (!updated) throw new HTTPException(404, { message: "Magic shelf not found" });
      return c.json(updated);
    },
  )
  .get(
    "/magic-shelves/:id/books",
    sValidator("param", IdParam),
    sValidator("query", MagicShelfBooksQuery),
    async (c) => {
      const u = c.var.user!;
      const { id } = c.req.valid("param");
      const q = c.req.valid("query");
      // Delegate to the books service so library scoping, content
      // restrictions, sort, and pagination all stay in one place.
      const result = await listBooks(u.id, u.isAdmin, { ...q, magicShelfId: id });
      return c.json(result);
    },
  )
  .delete("/magic-shelves/:id", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    await deleteMagicShelf(u.id, id);
    return c.json({ ok: true });
  });
