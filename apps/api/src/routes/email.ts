import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { authRequired, adminRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";
import {
  listEmailProviders,
  upsertEmailProvider,
  deleteEmailProvider,
  listRecipients,
  addRecipient,
  deleteRecipient,
} from "../services/email.ts";
import { enqueue } from "../services/tasks.ts";

const ProviderBody = type({
  name: "1 <= string <= 128",
  host: "1 <= string <= 256",
  "port?": "1 <= number.integer <= 65535",
  "secure?": "boolean",
  "username?": "string | null",
  "password?": "string | null",
  fromAddress: "string.email <= 256",
  "isDefault?": "boolean",
});

const RecipientBody = type({
  label: "1 <= string <= 128",
  email: "string.email <= 256",
});

const SendBody = type({
  bookId: "string.uuid",
  recipient: "string.email <= 256",
  "subject?": "string <= 256",
  "body?": "string <= 2048",
  "convertTo?": "'mobi' | 'azw3' | 'epub' | 'pdf'",
});

export const emailRoutes = new Hono()
  .use("*", authRequired)
  .get("/email/providers", adminRequired, async (c) => c.json(await listEmailProviders()))
  .post(
    "/email/providers",
    adminRequired,
    sValidator("json", ProviderBody),
    async (c) => {
      const id = await upsertEmailProvider(c.req.valid("json"));
      return c.json({ id }, 201);
    },
  )
  .delete("/email/providers/:id", adminRequired, sValidator("param", IdParam), async (c) => {
    await deleteEmailProvider(c.req.valid("param").id);
    return c.json({ ok: true });
  })

  .get("/email/recipients", async (c) => {
    const u = c.var.user!;
    return c.json(await listRecipients(u.id));
  })
  .post("/email/recipients", sValidator("json", RecipientBody), async (c) => {
    const u = c.var.user!;
    const id = await addRecipient({ userId: u.id, ...c.req.valid("json") });
    return c.json({ id }, 201);
  })
  .delete("/email/recipients/:id", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    await deleteRecipient(u.id, c.req.valid("param").id);
    return c.json({ ok: true });
  })

  .post("/email/send", sValidator("json", SendBody), async (c) => {
    const body = c.req.valid("json");
    // Enqueue rather than blocking — SMTP is slow and conversion via Calibre
    // can take a minute for large books. The client tracks progress via the
    // returned task id.
    const taskId = await enqueue("email-send", body);
    return c.json({ taskId }, 202);
  });
