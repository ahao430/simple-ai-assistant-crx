import type { WebDavConfig } from '../shared/modelConfig';

const STORAGE_KEY = 'gy-ai:webdav-config';

export function createDefaultWebDavConfig(): WebDavConfig {
  return {
    url: '',
    username: '',
    password: '',
    filePath: '/gy-ai-crx/model-configs.json',
    enabled: false,
    updatedAt: Date.now()
  };
}

export async function getWebDavConfig(): Promise<WebDavConfig> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return { ...createDefaultWebDavConfig(), ...(result[STORAGE_KEY] || {}) };
}

export async function saveWebDavConfig(config: WebDavConfig): Promise<WebDavConfig> {
  const next = { ...config, updatedAt: Date.now() };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}
