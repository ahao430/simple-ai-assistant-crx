import type { ModelConfig, ProviderConfig } from '../shared/modelConfig';

const MODEL_STORAGE_KEY = 'gy-ai:model-configs';
const PROVIDER_STORAGE_KEY = 'gy-ai:provider-configs';

export async function listProviderConfigs(): Promise<ProviderConfig[]> {
  const result = await chrome.storage.local.get(PROVIDER_STORAGE_KEY);
  return Array.isArray(result[PROVIDER_STORAGE_KEY]) ? result[PROVIDER_STORAGE_KEY] : [];
}

export async function saveProviderConfig(config: ProviderConfig): Promise<ProviderConfig> {
  const providers = await listProviderConfigs();
  const existingIndex = providers.findIndex((item) => item.id === config.id);
  const nextConfig = { ...config, updatedAt: Date.now() };
  const nextProviders = existingIndex >= 0
    ? providers.map((item, index) => index === existingIndex ? nextConfig : item)
    : [...providers, nextConfig];
  await chrome.storage.local.set({ [PROVIDER_STORAGE_KEY]: nextProviders });
  await syncProviderModels(nextConfig);
  return nextConfig;
}

export async function deleteProviderConfig(id: string): Promise<void> {
  const providers = await listProviderConfigs();
  await chrome.storage.local.set({ [PROVIDER_STORAGE_KEY]: providers.filter((item) => item.id !== id) });
}

export async function listModelConfigs(): Promise<ModelConfig[]> {
  const result = await chrome.storage.local.get(MODEL_STORAGE_KEY);
  return Array.isArray(result[MODEL_STORAGE_KEY]) ? result[MODEL_STORAGE_KEY] : [];
}

export async function saveModelConfig(config: ModelConfig): Promise<ModelConfig> {
  const configs = await listModelConfigs();
  const existingIndex = configs.findIndex((item) => item.id === config.id);
  const nextConfig = normalizeDefaults(await hydrateModelConfig(config), configs);
  const nextConfigs = existingIndex >= 0
    ? configs.map((item, index) => index === existingIndex ? nextConfig : item)
    : [...configs, nextConfig];
  await chrome.storage.local.set({ [MODEL_STORAGE_KEY]: nextConfigs });
  return nextConfig;
}

export async function deleteModelConfig(id: string): Promise<void> {
  const configs = await listModelConfigs();
  await chrome.storage.local.set({ [MODEL_STORAGE_KEY]: configs.filter((item) => item.id !== id) });
}

export async function replaceModelConfigs(configs: ModelConfig[]): Promise<void> {
  await chrome.storage.local.set({ [MODEL_STORAGE_KEY]: configs });
}

export async function getModelConfig(id: string): Promise<ModelConfig | undefined> {
  return (await listModelConfigs()).find((item) => item.id === id && item.enabled && item.providerEnabled !== false);
}

async function hydrateModelConfig(config: ModelConfig): Promise<ModelConfig> {
  if (!config.providerConfigId) return config;
  const provider = (await listProviderConfigs()).find((item) => item.id === config.providerConfigId);
  if (!provider) return config;
  return {
    ...config,
    provider: provider.provider,
    providerName: provider.name,
    providerEnabled: provider.enabled,
    baseURL: provider.baseURL,
    apiKey: provider.apiKey
  };
}

async function syncProviderModels(provider: ProviderConfig): Promise<void> {
  const configs = await listModelConfigs();
  const nextConfigs = configs.map((config) => config.providerConfigId === provider.id ? {
    ...config,
    provider: provider.provider,
    providerName: provider.name,
    providerEnabled: provider.enabled,
    baseURL: provider.baseURL,
    apiKey: provider.apiKey,
    updatedAt: Date.now()
  } : config);
  await chrome.storage.local.set({ [MODEL_STORAGE_KEY]: nextConfigs });
}

function normalizeDefaults(config: ModelConfig, configs: ModelConfig[]): ModelConfig {
  if (!config.defaultFor) return config;

  for (const capability of Object.keys(config.defaultFor)) {
    if (config.defaultFor[capability as keyof typeof config.defaultFor]) {
      for (const item of configs) {
        if (item.id !== config.id && item.defaultFor) {
          item.defaultFor[capability as keyof typeof item.defaultFor] = false;
        }
      }
    }
  }

  return config;
}
