import type { ImageAsset, ImageGenerationRequest } from './assets';
import type { ModelConfig, ProviderConfig, ProviderModelInfo, WebDavConfig } from './modelConfig';
import type { PageContext, SiteCapabilityDefinition, SiteContext } from './siteCapability';

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  displayContent?: string;
  hidden?: boolean;
  images?: string[];
  createdAt: number;
}

export interface ChatRequest {
  conversationId: string;
  modelConfigId: string;
  messages: ChatMessage[];
  pageContext?: PageContext;
  siteContext?: SiteContext;
}

export interface ChatResponse {
  message: ChatMessage;
}

export interface ActionRequest {
  type: SiteCapabilityDefinition['type'];
  payload?: unknown;
}

export interface ActionResult {
  ok: boolean;
  message: string;
  data?: unknown;
}

export type RuntimeRequest =
  | { type: 'providers:list' }
  | { type: 'providers:save'; config: ProviderConfig }
  | { type: 'providers:delete'; id: string }
  | { type: 'providers:list-models'; id: string }
  | { type: 'models:list' }
  | { type: 'models:save'; config: ModelConfig }
  | { type: 'models:delete'; id: string }
  | { type: 'webdav:get-config' }
  | { type: 'webdav:save-config'; config: WebDavConfig }
  | { type: 'webdav:test' }
  | { type: 'webdav:backup-models' }
  | { type: 'webdav:restore-models' }
  | { type: 'chat:send'; request: ChatRequest }
  | { type: 'chat:stream'; request: ChatRequest; streamId: string }
  | { type: 'image:generate'; request: ImageGenerationRequest }
  | { type: 'page:read' }
  | { type: 'site:detect' }
  | { type: 'site:action'; action: ActionRequest }
  | { type: 'content:read-page' }
  | { type: 'content:detect-site' }
  | { type: 'content:site-action'; action: ActionRequest };

export type RuntimeResponse =
  | { ok: true; providers: ProviderConfig[] }
  | { ok: true; provider: ProviderConfig }
  | { ok: true; providerModels: ProviderModelInfo[] }
  | { ok: true; models: ModelConfig[] }
  | { ok: true; model: ModelConfig }
  | { ok: true; webDavConfig: WebDavConfig }
  | { ok: true; message: string }
  | { ok: true; response: ChatResponse }
  | { ok: true; asset: ImageAsset }
  | { ok: true; pageContext: PageContext }
  | { ok: true; siteContext: SiteContext }
  | { ok: true; result: ActionResult }
  | { ok: true }
  | { ok: false; error: string };
