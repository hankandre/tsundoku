import nodemailer from "nodemailer";
import { eq, and } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { logger } from "../logger.ts";
import { resolveBookFile } from "./files.ts";

export type EmailProviderInput = {
  name: string;
  host: string;
  port?: number;
  secure?: boolean;
  username?: string | null;
  password?: string | null;
  fromAddress: string;
  isDefault?: boolean;
};

export async function listEmailProviders() {
  const db = requireDb();
  return db
    .select({
      id: schema.emailProviders.id,
      name: schema.emailProviders.name,
      host: schema.emailProviders.host,
      port: schema.emailProviders.port,
      secure: schema.emailProviders.secure,
      fromAddress: schema.emailProviders.fromAddress,
      isDefault: schema.emailProviders.isDefault,
      // passwordCipher intentionally NOT returned
    })
    .from(schema.emailProviders);
}

export async function upsertEmailProvider(input: EmailProviderInput): Promise<string> {
  const db = requireDb();
  // If isDefault, clear default flag on others first.
  if (input.isDefault) {
    await db.update(schema.emailProviders).set({ isDefault: false });
  }
  const inserted = await db
    .insert(schema.emailProviders)
    .values({
      name: input.name,
      host: input.host,
      port: input.port ?? 587,
      secure: input.secure ?? false,
      username: input.username ?? null,
      passwordCipher: input.password ?? null, // TODO: encrypt at rest
      fromAddress: input.fromAddress,
      isDefault: input.isDefault ?? false,
    })
    .returning({ id: schema.emailProviders.id });
  return inserted[0]!.id;
}

export async function deleteEmailProvider(id: string): Promise<void> {
  const db = requireDb();
  await db.delete(schema.emailProviders).where(eq(schema.emailProviders.id, id));
}

export async function listRecipients(userId: string) {
  const db = requireDb();
  return db
    .select()
    .from(schema.emailRecipients)
    .where(eq(schema.emailRecipients.userId, userId));
}

export async function addRecipient(input: { userId: string; label: string; email: string }): Promise<string> {
  const db = requireDb();
  const inserted = await db
    .insert(schema.emailRecipients)
    .values(input)
    .returning({ id: schema.emailRecipients.id });
  return inserted[0]!.id;
}

export async function deleteRecipient(userId: string, id: string): Promise<void> {
  const db = requireDb();
  await db
    .delete(schema.emailRecipients)
    .where(
      and(eq(schema.emailRecipients.id, id), eq(schema.emailRecipients.userId, userId)),
    );
}

/**
 * Convert a book file to a different format via Calibre's `ebook-convert`
 * binary if it's on PATH. Returns the converted file's absolute path. If
 * the tool isn't present, throws — the caller decides whether to fall back
 * to sending the original or surface the error.
 */
export async function convertBookFile(
  absPath: string,
  target: "mobi" | "azw3" | "epub" | "pdf",
): Promise<string> {
  const fs = await import("node:fs/promises");
  const nodePath = await import("node:path");
  const os = await import("node:os");
  const cp = await import("node:child_process");
  const tmp = await fs.mkdtemp(nodePath.join(os.tmpdir(), "tsundoku-convert-"));
  const dest = nodePath.join(tmp, `${nodePath.basename(absPath, nodePath.extname(absPath))}.${target}`);
  await new Promise<void>((resolve, reject) => {
    const child = cp.spawn("ebook-convert", [absPath, dest], { stdio: "ignore" });
    child.on("error", reject); // ENOENT if not installed
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ebook-convert exited with code ${code}`));
    });
  });
  return dest;
}

/**
 * Send the bytes of a book file to a recipient as an attachment. Used for
 * send-to-Kindle / Kobo etc. — those services accept email with the book
 * attached and ingest it.
 *
 * Optionally converts the file to a target format first (e.g. EPUB→MOBI for
 * Kindle). Falls through to the original on conversion failure unless the
 * caller forces strict mode.
 */
export async function sendBookByEmail(input: {
  bookId: string;
  recipient: string;
  subject?: string;
  body?: string;
  convertTo?: "mobi" | "azw3" | "epub" | "pdf";
}): Promise<void> {
  const db = requireDb();
  const providers = await db
    .select()
    .from(schema.emailProviders)
    .where(eq(schema.emailProviders.isDefault, true))
    .limit(1);
  const provider = providers[0];
  if (!provider) throw new Error("No default email provider configured");

  const file = await resolveBookFile(input.bookId);
  if (!file) throw new Error("Book file not found");

  // Optional conversion. If `ebook-convert` isn't installed we log and
  // continue with the original file — best-effort UX for the common case.
  let attachmentPath = file.absolutePath;
  if (input.convertTo) {
    try {
      attachmentPath = await convertBookFile(file.absolutePath, input.convertTo);
    } catch (e) {
      logger.warn(
        { err: e, bookId: input.bookId, target: input.convertTo },
        "convert failed; sending original",
      );
    }
  }

  const transport = nodemailer.createTransport({
    host: provider.host,
    port: provider.port,
    secure: provider.secure,
    auth: provider.username
      ? { user: provider.username, pass: provider.passwordCipher ?? "" }
      : undefined,
  });

  await transport.sendMail({
    from: provider.fromAddress,
    to: input.recipient,
    subject: input.subject ?? "Your book",
    text: input.body ?? "Sent from tsundoku.",
    attachments: [{ path: attachmentPath }],
  });
  logger.info({ bookId: input.bookId, recipient: input.recipient }, "book emailed");
}
