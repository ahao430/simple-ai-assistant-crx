import type { AIProviderAdapter } from './types';

export const anthropicTextProvider: AIProviderAdapter = {
  id: 'anthropic',
  supports(config) {
    return config.provider === 'anthropic' && config.capabilities.includes('text');
  },
  async chat() {
    throw new Error('Anthropic provider 尚未配置 API 调用实现');
  }
};
