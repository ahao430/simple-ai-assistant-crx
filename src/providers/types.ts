import type { ChatRequest, ChatResponse } from '../shared/messages';
import type { ModelConfig } from '../shared/modelConfig';
import type { ImageAsset, ImageGenerationRequest } from '../shared/assets';

export interface AIProviderAdapter {
  id: string;
  supports(config: ModelConfig): boolean;
  chat(request: ChatRequest, config: ModelConfig): Promise<ChatResponse>;
  streamChat?(request: ChatRequest, config: ModelConfig, onChunk: (chunk: string) => void): Promise<ChatResponse>;
  generateImage?(request: ImageGenerationRequest, config: ModelConfig): Promise<ImageAsset>;
  editImage?(request: ImageGenerationRequest, config: ModelConfig): Promise<ImageAsset>;
}
