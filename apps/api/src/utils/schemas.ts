import { type } from "arktype";

// Reusable param shapes for routes. With @hono/standard-validator, any Standard
// Schema validator (arktype/zod/valibot) plugs into `sValidator("param", ...)`.
// We use arktype here because it ships UUID parsing in core (`string.uuid`).

export const IdParam = type({ id: "string.uuid" });

export const LibraryPathParam = type({
  id: "string.uuid",
  pathId: "string.uuid",
});

export const NoteIdParam = type({ noteId: "string.uuid" });

export const BookmarkIdParam = type({ bookmarkId: "string.uuid" });

export const UserIdParam = type({ id: "string.uuid" });
