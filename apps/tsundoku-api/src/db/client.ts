import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env";
import * as usersSchema from "./schema/users";
import * as booksSchema from "./schema/books";
import * as shelvesSchema from "./schema/shelves";
import * as koboSchema from "./schema/kobo";
import * as koreaderSchema from "./schema/koreader";
import * as opdsSchema from "./schema/opds";
import * as bookdropSchema from "./schema/bookdrop";
import * as auditSchema from "./schema/audit";
import * as metadataSchema from "./schema/metadata";
import * as annotationsSchema from "./schema/annotations";
import * as tasksSchema from "./schema/tasks";
import * as oidcSchema from "./schema/oidc";
import * as comicSchema from "./schema/comic";
import * as contentRestrictionSchema from "./schema/content-restriction";
import * as filesSchema from "./schema/files";
import * as emailSchema from "./schema/email";
import * as metadataExtSchema from "./schema/metadata-ext";
import * as progressSchema from "./schema/progress";
import * as viewersSchema from "./schema/viewers";

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

if (!env.databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const queryClient = postgres(env.databaseUrl, {
  max: 20,
  prepare: true,
  idle_timeout: 20,
  connect_timeout: 10,
  transform: {
    undefined: null,
  },
});

export const db = drizzle(queryClient, { schema });
export const sql = queryClient;
export { schema };
