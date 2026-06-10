export type SubmitShortcut = 'enter' | 'mod-enter';

export interface AppSettings {
  submitShortcut: SubmitShortcut;
  updatedAt: number;
}

export const APP_SETTINGS_STORAGE_KEY = 'gy-ai:app-settings';

export function createDefaultAppSettings(): AppSettings {
  return {
    submitShortcut: 'enter',
    updatedAt: Date.now()
  };
}

export function normalizeAppSettings(settings?: Partial<AppSettings>): AppSettings {
  const defaults = createDefaultAppSettings();
  return {
    ...defaults,
    ...settings,
    submitShortcut: settings?.submitShortcut === 'mod-enter' ? 'mod-enter' : 'enter'
  };
}

export function getSubmitShortcutHint(submitShortcut: SubmitShortcut): string {
  return submitShortcut === 'enter'
    ? 'Enter 发送，Command/Ctrl + Enter 换行'
    : 'Command/Ctrl + Enter 发送，Enter 换行';
}
