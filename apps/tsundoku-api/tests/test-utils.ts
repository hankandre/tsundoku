import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as usersSchema from "../src/db/schema/users";
import * as booksSchema from "../src/db/schema/books";
import * as shelvesSchema from "../src/db/schema/shelves";
import * as koboSchema from "../src/db/schema/kobo";
import * as koreaderSchema from "../src/db/schema/koreader";
import * as opdsSchema from "../src/db/schema/opds";
import * as bookdropSchema from "../src/db/schema/bookdrop";
import * as auditSchema from "../src/db/schema/audit";
import * as metadataSchema from "../src/db/schema/metadata";
import * as annotationsSchema from "../src/db/schema/annotations";
import * as tasksSchema from "../src/db/schema/tasks";
import * as oidcSchema from "../src/db/schema/oidc";
import * as comicSchema from "../src/db/schema/comic";
import * as contentRestrictionSchema from "../src/db/schema/content-restriction";
import * as filesSchema from "../src/db/schema/files";
import * as emailSchema from "../src/db/schema/email";
import * as metadataExtSchema from "../src/db/schema/metadata-ext";
import * as progressSchema from "../src/db/schema/progress";
import * as viewersSchema from "../src/db/schema/viewers";

const schema = {
  ...usersSchema,
  ...booksSchema,
  ...shelvesSchema,
  ...koboSchema,
  ...koreaderSchema,
  ...opdsSchema,
  ...bookdropSchema,
  ...auditSchema,
  ...metadataSchema,
  ...annotationsSchema,
  ...tasksSchema,
  ...oidcSchema,
  ...comicSchema,
  ...contentRestrictionSchema,
  ...filesSchema,
  ...emailSchema,
  ...metadataExtSchema,
  ...progressSchema,
  ...viewersSchema,
};

let pgliteClient: PGlite | null = null;
let testDb: ReturnType<typeof drizzle> | null = null;

export type TestDatabaseHandle = {
  client: PGlite;
  db: ReturnType<typeof drizzle>;
  dispose: () => Promise<void>;
};

export async function makeTestDb(): Promise<TestDatabaseHandle> {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  await migrate(db, {
    migrationsFolder: `${import.meta.dir}/../drizzle`,
  });

  return {
    client,
    db,
    async dispose() {
      await client.close();
    },
  };
}

export async function createTestDatabase(): Promise<ReturnType<typeof drizzle>> {
  const testDatabase = await makeTestDb();
  pgliteClient = testDatabase.client;
  testDb = testDatabase.db;

  return testDb;
}

export async function closeTestDatabase(): Promise<void> {
  if (pgliteClient) {
    await pgliteClient.close();
    pgliteClient = null;
    testDb = null;
  }
}

export function getTestDb() {
  return testDb;
}

export { schema };
