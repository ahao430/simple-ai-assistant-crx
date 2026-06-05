import type { ModelCapability, ModelConfig, ModelProvider, ProviderConfig } from './modelConfig';

export function createProviderConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: '',
    provider: 'openai-compatible',
    baseURL: 'https://api.openai.com/v1',
    apiKey: '',
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

export function createModelConfig(overrides: Partial<ModelConfig> = {}): ModelConfig {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: '',
    provider: 'openai-compatible',
    providerConfigId: undefined,
    providerName: undefined,
    providerEnabled: undefined,
    model: '',
    baseURL: '',
    apiKey: '',
    capabilities: ['text'],
    defaultFor: {},
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

export function createModelConfigFromProvider(provider: ProviderConfig, overrides: Partial<ModelConfig> = {}): ModelConfig {
  return createModelConfig({
    provider: provider.provider,
    providerConfigId: provider.id,
    providerName: provider.name,
    providerEnabled: provider.enabled,
    baseURL: provider.baseURL,
    apiKey: provider.apiKey,
    ...overrides
  });
}

export function findDefaultModel(configs: ModelConfig[], capability: ModelCapability): ModelConfig | undefined {
  return configs.find((config) => config.enabled && config.providerEnabled !== false && config.capabilities.includes(capability) && config.defaultFor?.[capability])
    || configs.find((config) => config.enabled && config.providerEnabled !== false && config.capabilities.includes(capability));
}

export function getModelProviderGroupName(model: Pick<ModelConfig, 'provider' | 'providerName' | 'baseURL'>): string {
  return model.providerName || model.baseURL || providerFallbackName(model.provider);
}

function providerFallbackName(provider: ModelProvider): string {
  if (provider === 'openai-compatible') return 'OpenAI 兼容';
  if (provider === 'anthropic') return 'Anthropic';
  return '自定义';
}
