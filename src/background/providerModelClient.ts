import type { ProviderConfig, ProviderModelInfo } from '../shared/modelConfig';

export async function listProviderModels(config: ProviderConfig): Promise<ProviderModelInfo[]> {
  if (config.provider === 'anthropic') return listAnthropicModels(config);
  if (config.provider === 'openai-compatible' || config.provider === 'custom') return listOpenAICompatibleModels(config);
  throw new Error('当前供应商暂不支持自动获取模型列表');
}

async function listOpenAICompatibleModels(config: ProviderConfig): Promise<ProviderModelInfo[]> {
  const response = await fetch(`${config.baseURL.replace(/\/+$/, '')}/models`, {
    headers: { Authorization: `Bearer ${config.apiKey}` }
  });

  if (!response.ok) {
    throw new Error(`获取模型列表失败：${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  if (!Array.isArray(data.data)) return [];

  return normalizeModels(data.data.map((item: any) => ({ id: String(item.id || ''), name: String(item.id || '') })));
}

async function listAnthropicModels(config: ProviderConfig): Promise<ProviderModelInfo[]> {
  const response = await fetch(`${config.baseURL.replace(/\/+$/, '')}/models`, {
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01'
    }
  });

  if (!response.ok) {
    throw new Error(`获取模型列表失败：${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  if (!Array.isArray(data.data)) return [];

  return normalizeModels(data.data.map((item: any) => ({
    id: String(item.id || ''),
    name: String(item.display_name || item.id || '')
  })));
}

function normalizeModels(models: ProviderModelInfo[]): ProviderModelInfo[] {
  return models
    .filter((item) => item.id)
    .sort((a, b) => a.name.localeCompare(b.name));
}
