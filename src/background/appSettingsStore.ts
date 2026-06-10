import { APP_SETTINGS_STORAGE_KEY, createDefaultAppSettings, normalizeAppSettings, type AppSettings } from '../shared/appSettings';

export async function getAppSettings(): Promise<AppSettings> {
  const result = await chrome.storage.local.get(APP_SETTINGS_STORAGE_KEY);
  return normalizeAppSettings(result[APP_SETTINGS_STORAGE_KEY] as Partial<AppSettings> | undefined);
}

export async function saveAppSettings(settings: AppSettings): Promise<AppSettings> {
  const next = normalizeAppSettings({ ...settings, updatedAt: Date.now() });
  await chrome.storage.local.set({ [APP_SETTINGS_STORAGE_KEY]: next });
  return next;
}

export async function restoreAppSettings(settings?: Partial<AppSettings>): Promise<AppSettings> {
  const next = normalizeAppSettings(settings || createDefaultAppSettings());
  await chrome.storage.local.set({ [APP_SETTINGS_STORAGE_KEY]: next });
  return next;
}
