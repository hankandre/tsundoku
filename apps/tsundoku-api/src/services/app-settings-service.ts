import { db, schema } from "../db/client";
import { eq, and } from "drizzle-orm";
import { fail, assertIsDefined } from "../http/errors";

export interface AppSettingRow {
  id: string;
  category: string;
  name: string;
  value: string;
  createdAt: Date;
  updatedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface AppSettingsResponse {
  registrationEnabled: boolean;
  libraryManagementEnabled: boolean;
  remoteAuthEnabled: boolean;
  allowExternalBookManagement: boolean;
}

export interface PublicSettingsResponse {
  registrationEnabled: boolean;
}

export const getAllAppSettings = async (): Promise<AppSettingRow[]> => {
  assertIsDefined(db, "Database not configured");
  return await db.select().from(schema.appSettings);
};

export const getAppSettingByKey = async (category: string, name: string): Promise<AppSettingRow | undefined> => {
  assertIsDefined(db, "Database not configured");
  const result = await db
    .select()
    .from(schema.appSettings)
    .where(and(
      eq(schema.appSettings.category, category),
      eq(schema.appSettings.name, name)
    ));
  return result[0];
};

export const getAppSettings = async (): Promise<AppSettingsResponse> => {
  const settings = await getAllAppSettings();
  
  const settingMap = new Map<string, string>();
  for (const s of settings) {
    settingMap.set(`${s.category}.${s.name}`, s.value);
  }

  return {
    registrationEnabled: settingMap.get("registration.enabled") === "true",
    libraryManagementEnabled: settingMap.get("library.managementEnabled") === "true",
    remoteAuthEnabled: settingMap.get("auth.remoteAuthEnabled") === "true",
    allowExternalBookManagement: settingMap.get("library.allowExternalBookManagement") === "true",
  };
};

export const getPublicSettings = async (): Promise<PublicSettingsResponse> => {
  const registrationSetting = await getAppSettingByKey("registration", "enabled");
  return {
    registrationEnabled: registrationSetting?.value === "true",
  };
};

export const updateSetting = async (category: string, name: string, value: string): Promise<void> => {
  assertIsDefined(db, "Database not configured");
  
  const existing = await getAppSettingByKey(category, name);
  
  if (existing) {
    await db
      .update(schema.appSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(schema.appSettings.id, existing.id));
  } else {
    await db.insert(schema.appSettings).values({
      category,
      name,
      value,
    });
  }
};
