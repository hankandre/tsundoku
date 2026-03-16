import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables, AuthUser } from "../types/app-variables";
import { fail, handleValidationError } from "../http/errors";
import {
  getNotesForBook,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
} from "../services/book-note-service";

const getAuthUser = (c: import("hono").Context): AuthUser => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser as AuthUser;
};

const createNoteSchema = z.object({
  bookId: z.string(),
  cfi: z.string().optional(),
  text: z.string().min(1),
});

const updateNoteSchema = z.object({
  cfi: z.string().optional(),
  text: z.string().min(1).optional(),
});

const noteIdParamSchema = z.object({
  noteId: z.string(),
});

const bookIdParamSchema = z.object({
  bookId: z.uuidv7(),
});

const validateNoteId = zValidator("param", noteIdParamSchema, handleValidationError);
const validateBookId = zValidator("param", bookIdParamSchema, handleValidationError);

export const bookNoteRoutes = new Hono<{ Variables: AppVariables }>();

bookNoteRoutes.get("/book/:bookId", validateBookId, async (c) => {
  const authUser = getAuthUser(c);
  const { bookId } = c.req.valid("param");
  
  const notes = await getNotesForBook(bookId, authUser.userId);
  return c.json(notes, 200);
});

bookNoteRoutes.get("/:noteId", validateNoteId, async (c) => {
  const authUser = getAuthUser(c);
  const { noteId } = c.req.valid("param");
  
  const note = await getNoteById(noteId, authUser.userId);
  if (!note) {
    fail(404, `Note not found: ${noteId}`);
  }
  
  return c.json(note, 200);
});

bookNoteRoutes.post("/", zValidator("json", createNoteSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const input = c.req.valid("json");
  
  const note = await createNote(authUser.userId, input);
  return c.json(note, 200);
});

bookNoteRoutes.put("/:noteId", validateNoteId, zValidator("json", updateNoteSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const { noteId } = c.req.valid("param");
  const input = c.req.valid("json");
  
  const note = await updateNote(noteId, authUser.userId, input);
  return c.json(note, 200);
});

bookNoteRoutes.delete("/:noteId", validateNoteId, async (c) => {
  const authUser = getAuthUser(c);
  const { noteId } = c.req.valid("param");
  
  await deleteNote(noteId, authUser.userId);
  return c.body(null, 204);
});
