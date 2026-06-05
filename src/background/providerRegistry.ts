import type { ImageGenerationRequest } from '../shared/assets';
import type { ChatRequest } from '../shared/messages';
import type { ModelConfig } from '../shared/modelConfig';
import { anthropicTextProvider } from '../providers/anthropicTextProvider';
import { openaiImageProvider } from '../providers/openaiImageProvider';
import { openaiTextProvider } from '../providers/openaiTextProvider';
import type { AIProviderAdapter } from '../providers/types';

const providers: AIProviderAdapter[] = [openaiTextProvider, openaiImageProvider, anthropicTextProvider];

export async function sendChat(request: ChatRequest, config: ModelConfig) {
  const provider = resolveProvider(config, 'chat');
  return provider.chat(request, config);
}

export async function streamChat(request: ChatRequest, config: ModelConfig, onChunk: (chunk: string) => void) {
  const provider = resolveProvider(config, 'chat');
  if (!provider.streamChat) return provider.chat(request, config);
  return provider.streamChat(request, config, onChunk);
}

export async function generateImage(request: ImageGenerationRequest, config: ModelConfig) {
  const shouldUseImageInput = request.mode === 'edit' || !!request.referenceImages?.length;
  const provider = resolveProvider(config, shouldUseImageInput ? 'editImage' : 'generateImage');
  const fn = shouldUseImageInput ? provider.editImage : provider.generateImage;
  if (!fn) throw new Error('当前模型不支持该图片操作');
  return fn(request, config);
}

function resolveProvider(config: ModelConfig, method: keyof AIProviderAdapter): AIProviderAdapter {
  const provider = providers.find((item) => item.supports(config) && typeof item[method] === 'function');
  if (!provider) throw new Error(`没有找到可用的模型适配器：${config.name}`);
  return provider;
}
