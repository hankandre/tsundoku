/**
 * Direct end-to-end scan smoke test. Bypasses HTTP — calls the services
 * straight against the dev DB. Validates: walk → extractor → DB insert →
 * cover save. Run with:
 *   DATABASE_URL=... JWT_SECRET=... bun apps/api/test-scan.ts
 */
import { db } from "./src/db.ts";
import { schema } from "@tsundoku/db";
import { eq } from "drizzle-orm";
import { createFirstAdminIfEmpty } from "./src/services/users.ts";
import { createLibrary } from "./src/services/libraries.ts";
import { scanLibrary } from "./src/services/scan.ts";
import { findCover } from "./src/services/covers.ts";

const FIXTURE_PATH = `${process.env.HOME}/tsundoku-test-library`;

async function main() {
  if (!db) throw new Error("DB not initialized — set DATABASE_URL");

  // 1. Setup user if empty.
  const existing = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  let userId: string;
  if (existing.length === 0) {
    const u = await createFirstAdminIfEmpty({
      username: "scan-test-admin",
      password: "scan-test-pass",
    });
    if (!u) throw new Error("setup race");
    userId = u.id;
    console.log(`[ok] created admin ${userId}`);
  } else {
    userId = existing[0]!.id;
    console.log(`[ok] using existing user ${userId}`);
  }

  // 2. Create or reuse a library pointing at FIXTURE_PATH.
  const existingLibs = await db
    .select()
    .from(schema.libraries)
    .where(eq(schema.libraries.name, "scan-test"))
    .limit(1);
  let libraryId: string;
  if (existingLibs.length === 0) {
    const lib = await createLibrary({
      name: "scan-test",
      paths: [FIXTURE_PATH],
    });
    libraryId = lib.id;
    console.log(`[ok] created library ${libraryId} → ${FIXTURE_PATH}`);
  } else {
    libraryId = existingLibs[0]!.id;
    console.log(`[ok] using library ${libraryId}`);
  }

  // 3. Run scan.
  console.log(`[..] scanning…`);
  const result = await scanLibrary(libraryId, (p) => {
    if (p.detail) console.log(`     ${p.detail} (${Math.round((p.progress ?? 0) * 100)}%)`);
  });
  console.log(`[ok] scanned=${result.scanned} added=${result.added} skipped=${result.skipped}`);
  if (result.errors.length) {
    console.log(`[warn] errors: ${result.errors.length}`);
    for (const e of result.errors) console.log(`       ${e.path}: ${e.error}`);
  }

  // 4. Verify a book + metadata + cover landed.
  const books = await db.select().from(schema.books).where(eq(schema.books.libraryId, libraryId));
  console.log(`[ok] ${books.length} book(s) in library`);
  for (const b of books) {
    const meta = await db
      .select()
      .from(schema.bookMetadata)
      .where(eq(schema.bookMetadata.bookId, b.id))
      .limit(1);
    const cover = await findCover(b.id);
    console.log(
      `     • ${b.fileName}\n       type=${b.bookType} title=${meta[0]?.title ?? "—"} authors=…cover=${cover ? "yes" : "no"}`,
    );
  }
  console.log(`[done]`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
