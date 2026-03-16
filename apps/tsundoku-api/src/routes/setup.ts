import { Hono } from "hono";
import { fail } from "../http/errors";
import { sql } from "../db/client";
import type { AppVariables } from "../types/app-variables";

const ensureDb = () => {
  if (!sql) {
    fail(503, "Database is not configured. Set DATABASE_URL.");
  }
  return sql as NonNullable<typeof sql>;
};

export const setupRoutes = new Hono<{ Variables: AppVariables }>();

setupRoutes.get("/status", async (c) => {
  const client = ensureDb();
  const result = await client<{ count: number }[]>`select count(*) as count from users`;
  const isCompleted = (result[0]?.count ?? 0) > 0;

  const message = isCompleted
    ? "Initial setup has already been completed."
    : "Initial setup is pending. No users have been created yet.";

  return c.json({
    status: 200,
    message,
    data: isCompleted,
    timestamp: new Date().toISOString(),
  });
});

setupRoutes.post("/", async (c) => {
  const client = ensureDb();
  const existing = await client<{ count: number }[]>`select count(*) as count from users`;
  if ((existing[0]?.count ?? 0) > 0) {
    fail(403, "Setup is disabled after the first user is created.");
  }

  const body = await c.req.json<{
    username: string;
    password: string;
    name: string;
    email: string;
  }>();

  if (!body.username || !body.password || !body.name || !body.email) {
    fail(400, "Missing required fields: username, password, name, email");
  }

  if (body.password.length < 8) {
    fail(400, "Password must be at least 8 characters long");
  }

  const passwordHash = await Bun.password.hash(body.password, { algorithm: "argon2id" });

  const userId = Bun.randomUUIDv7();

  await client`
    insert into users (id, username, password_hash, is_default_password, name, email, provisioning_method)
    values (${userId}, ${body.username}, ${passwordHash}, false, ${body.name}, ${body.email}, 'LOCAL')
  `;

  await client`
      insert into user_permissions (
        user_id,
        permission_upload,
        permission_download,
        permission_edit_metadata,
        permission_manipulate_library,
        permission_email_book,
        permission_delete_book,
        permission_access_opds,
        permission_sync_koreader,
        permission_sync_kobo,
        permission_admin,
        permission_manage_metadata_config,
        permission_access_bookdrop,
        permission_access_library_stats,
        permission_access_user_stats,
        permission_access_task_manager,
        permission_manage_global_preferences,
        permission_manage_icons,
        permission_manage_fonts,
        permission_bulk_auto_fetch_metadata,
        permission_bulk_custom_fetch_metadata,
        permission_bulk_edit_metadata,
        permission_bulk_regenerate_cover,
        permission_move_organize_files,
        permission_bulk_lock_unlock_metadata,
        permission_bulk_reset_booklore_read_progress,
        permission_bulk_reset_koreader_read_progress,
        permission_bulk_reset_book_read_status
      )
      values (
        ${userId},
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true
      )
    `;

  return c.json({
    status: 200,
    message: "Admin user created successfully.",
    timestamp: new Date().toISOString(),
  });
});
