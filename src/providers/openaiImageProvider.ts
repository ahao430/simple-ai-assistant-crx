import type { ImageAsset } from '../shared/assets';
import type { AIProviderAdapter } from './types';

const IMAGE_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

export const openaiImageProvider: AIProviderAdapter = {
  id: 'openai-image',
  supports(config) {
    return config.provider === 'openai-compatible' && (config.capabilities.includes('image-generation') || config.capabilities.includes('image-edit'));
  },
  async chat() {
    throw new Error('当前模型配置不支持文本对话');
  },
  async generateImage(request, config) {
    const endpoint = `${config.baseURL || 'https://api.openai.com/v1'}/images/generations`;
    const body: Record<string, unknown> = {
      model: config.model,
      prompt: request.prompt,
      response_format: 'b64_json'
    };

    if (request.referenceImages?.length) {
      body.image = request.referenceImages;
    }

    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`图片生成失败：${response.status} ${await response.text()}`);
    }

    return toImageAsset(await response.json(), 'generated', request.modelConfigId, request.prompt);
  },
  async editImage(request, config) {
    const endpoint = `${config.baseURL || 'https://api.openai.com/v1'}/images/edits`;
    const body = new FormData();
    body.set('model', config.model);
    body.set('prompt', request.prompt);

    if (request.editImage) {
      body.set('image', dataUrlToBlob(request.editImage), 'image.png');
    }

    request.referenceImages?.forEach((image, index) => {
      body.append('image[]', dataUrlToBlob(image), `reference-${index}.png`);
    });

    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`
      },
      body
    });

    if (!response.ok) {
      throw new Error(`图片修改失败：${response.status} ${await response.text()}`);
    }

    return toImageAsset(await response.json(), 'edited', request.modelConfigId, request.prompt);
  }
};

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function toImageAsset(data: any, source: ImageAsset['source'], modelConfigId: string, prompt: string): ImageAsset {
  const item = data.data?.[0];
  const mimeType = 'image/png';
  const dataUrl = item?.b64_json ? `data:${mimeType};base64,${item.b64_json}` : item?.url || '';

  return {
    id: crypto.randomUUID(),
    source,
    mimeType,
    dataUrl,
    createdByModelConfigId: modelConfigId,
    prompt,
    createdAt: Date.now()
  };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',');
  const mimeType = meta.match(/data:(.*);base64/)?.[1] || 'image/png';
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}
