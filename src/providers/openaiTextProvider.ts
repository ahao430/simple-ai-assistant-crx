import type { ChatRequest, ChatResponse } from '../shared/messages';
import type { ModelConfig } from '../shared/modelConfig';
import type { AIProviderAdapter } from './types';

export const openaiTextProvider: AIProviderAdapter = {
  id: 'openai-text',
  supports(config) {
    return config.provider === 'openai-compatible' && config.capabilities.includes('text');
  },
  async chat(request, config) {
    const response = await requestChat(request, config, false);

    if (!response.ok) {
      throw new Error(`模型请求失败：${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return createChatResponse(data.choices?.[0]?.message?.content || '');
  },
  async streamChat(request, config, onChunk) {
    const response = await requestChat(request, config, true);

    if (!response.ok) {
      throw new Error(`模型请求失败：${response.status} ${await response.text()}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('模型未返回流式响应');

    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return createChatResponse(content);

        const chunk = parseStreamChunk(data);
        if (!chunk) continue;
        content += chunk;
        onChunk(chunk);
      }
    }

    return createChatResponse(content);
  }
};

async function requestChat(request: ChatRequest, config: ModelConfig, stream: boolean): Promise<Response> {
  const endpoint = `${config.baseURL || 'https://api.openai.com/v1'}/chat/completions`;
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: request.messages.map(({ role, content, images }) => {
        if (images?.length) {
          return { role, content: [{ type: 'text', text: content }, ...images.map((url) => ({ type: 'image_url', image_url: { url } }))] };
        }
        return { role, content };
      }),
      stream
    })
  });
}

function parseStreamChunk(data: string): string {
  try {
    return JSON.parse(data).choices?.[0]?.delta?.content || '';
  } catch {
    return '';
  }
}

function createChatResponse(content: string): ChatResponse {
  return {
    message: {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      createdAt: Date.now()
    }
  };
}
