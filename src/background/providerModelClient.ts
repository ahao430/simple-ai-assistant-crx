import type { ProviderConfig, ProviderModelInfo } from '../shared/modelConfig';

export async function listProviderModels(config: ProviderConfig): Promise<ProviderModelInfo[]> {
  if (config.provider === 'anthropic') {
    if (/open\.bigmodel\.cn/.test(config.baseURL)) {
      throw new Error('智谱请使用 OpenAI 兼容供应商，Base URL 填 https://open.bigmodel.cn/api/paas/v4；GLM 编码套餐填 https://open.bigmodel.cn/api/coding/paas/v4');
    }
    return listAnthropicModels(config);
  }
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

  const models = parseProviderModels(await response.json());
  if (!models.length) throw new Error('获取模型列表失败：平台返回了空模型列表或非标准模型列表格式');

  return models;
}

async function listAnthropicModels(config: ProviderConfig): Promise<ProviderModelInfo[]> {
  const baseURL = config.baseURL.replace(/\/+$/, '');
  const urls = [`${baseURL}/models`];
  if (!/\/v\d+$/.test(baseURL)) urls.push(`${baseURL}/v1/models`);

  let lastError = '';
  for (const url of urls) {
    for (const headers of createAnthropicAuthHeaders(config.apiKey)) {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        lastError = `${response.status} ${await response.text()}`;
        continue;
      }

      const models = parseProviderModels(await response.json());
      if (models.length) return models;
      lastError = '平台返回了空模型列表或非标准模型列表格式';
    }
  }

  throw new Error(`获取模型列表失败：${lastError}`);
}

function createAnthropicAuthHeaders(apiKey: string): HeadersInit[] {
  const commonHeaders = { 'anthropic-version': '2023-06-01' };
  return [
    { ...commonHeaders, 'x-api-key': apiKey },
    { ...commonHeaders, Authorization: `Bearer ${apiKey}` }
  ];
}

function parseProviderModels(data: any): ProviderModelInfo[] {
  const items = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : Array.isArray(data) ? data : [];
  return normalizeModels(items.map((item: any) => {
    const id = typeof item === 'string' ? item : String(item.id || item.name || '');
    return {
      id,
      name: typeof item === 'string' ? item : String(item.display_name || item.name || item.id || '')
    };
  }));
}

function normalizeModels(models: ProviderModelInfo[]): ProviderModelInfo[] {
  return models
    .filter((item) => item.id)
    .sort((a, b) => a.name.localeCompare(b.name));
}
