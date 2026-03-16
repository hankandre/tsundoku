import { mock } from "bun:test";
import { makeTestDb, schema, type TestDatabaseHandle } from "../test-utils";

let integrationTestDatabase: TestDatabaseHandle | null = null;
let integrationDatabase: TestDatabaseHandle["db"] | null = null;

const applyDbClientMock = () => {
  if (!integrationDatabase) {
    throw new Error("Integration database is not initialized");
  }

  mock.module("../../src/db/client", () => ({
    db: integrationDatabase,
    sql: {},
    schema,
  }));
};

export const createIntegrationDatabase = async (): Promise<void> => {
  if (integrationTestDatabase) {
    await integrationTestDatabase.dispose();
  }
  integrationTestDatabase = await makeTestDb();
  integrationDatabase = integrationTestDatabase.db;
  applyDbClientMock();
};

export const getIntegrationDatabase = () => {
  if (!integrationDatabase) {
    throw new Error("Integration database is not initialized");
  }

  return integrationDatabase;
};

export const closeIntegrationDatabase = async (): Promise<void> => {
  if (integrationTestDatabase) {
    await integrationTestDatabase.dispose();
  }
  integrationTestDatabase = null;
  integrationDatabase = null;
};
