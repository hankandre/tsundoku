import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  index,
} from "drizzle-orm/pg-core";

const uuidv7 = () => Bun.randomUUIDv7();

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  type: varchar("type", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  userId: uuid("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  progressPercentage: integer("progress_percentage"),
  message: text("message"),
  errorDetails: text("error_details"),
  taskOptions: text("task_options"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("tasks_user_idx").on(table.userId),
  index("tasks_type_idx").on(table.type),
  index("tasks_status_idx").on(table.status),
  index("tasks_created_at_idx").on(table.createdAt),
]);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export const taskCronConfiguration = pgTable("task_cron_configuration", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  taskType: varchar("task_type", { length: 100 }).notNull().unique(),
  cronExpression: varchar("cron_expression", { length: 100 }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: uuid("created_by").notNull().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by"),
});

export type TaskCronConfiguration = typeof taskCronConfiguration.$inferSelect;
export type NewTaskCronConfiguration = typeof taskCronConfiguration.$inferInsert;
