import type { AgentConfig } from './agentConfig';
import type { AppSettings } from './appSettings';

export type ModelCapability = 'text' | 'vision' | 'image-generation' | 'image-edit' | 'video-generation';

export type ModelProvider = 'openai-compatible' | 'anthropic' | 'custom';

export interface ProviderConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  baseURL: string;
  apiKey: string;
  enabled: boolean;
  modelList?: ProviderModelInfo[];
  createdAt: number;
  updatedAt: number;
}

export interface ProviderModelInfo {
  id: string;
  name: string;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  providerConfigId?: string;
  providerName?: string;
  providerEnabled?: boolean;
  model: string;
  baseURL?: string;
  apiKey: string;
  capabilities: ModelCapability[];
  defaultFor?: Partial<Record<ModelCapability, boolean>>;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ModelConfigInput = Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>;

export const MODEL_CAPABILITY_LABELS: Record<ModelCapability, string> = {
  text: '文本对话',
  vision: '视觉理解',
  'image-generation': '图片生成',
  'image-edit': '图片编辑',
  'video-generation': '视频生成'
};

export const MODEL_PROVIDER_LABELS: Record<ModelProvider, string> = {
  'openai-compatible': 'OpenAI 兼容',
  anthropic: 'Anthropic',
  custom: '自定义'
};

export interface WebDavConfig {
  url: string;
  username: string;
  password: string;
  filePath: string;
  enabled: boolean;
  updatedAt: number;
}

export interface BackupPayload {
  version: 1;
  app: 'gy-ai-crx';
  exportedAt: number;
  models: ModelConfig[];
  agents?: AgentConfig[];
  settings?: AppSettings;
}
