import type { AgentConfig } from '../shared/agentConfig';
import { AGENT_STORAGE_KEY } from '../shared/agentConfig';
import type { RuntimeRequest, RuntimeResponse } from '../shared/messages';
import { createErrorResponse } from '../shared/errors';
import { deleteModelConfig, deleteProviderConfig, getModelConfig, listModelConfigs, listProviderConfigs, replaceModelConfigs, saveModelConfig, saveProviderConfig } from './modelConfigStore';
import { listProviderModels } from './providerModelClient';
import { downloadBackup, testWebDavConnection, uploadBackup } from './webdavClient';
import { getAppSettings, restoreAppSettings, saveAppSettings } from './appSettingsStore';
import { getWebDavConfig, saveWebDavConfig } from './webdavBackupStore';
import { generateImage, sendChat, streamChat } from './providerRegistry';

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener((message: RuntimeRequest, sender, sendResponse: (response: RuntimeResponse) => void) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => sendResponse(createErrorResponse(error)));
  return true;
});

async function handleMessage(message: RuntimeRequest, sender: chrome.runtime.MessageSender): Promise<RuntimeResponse> {
  switch (message.type) {
    case 'providers:list':
      return { ok: true, providers: await listProviderConfigs() };
    case 'providers:save':
      return { ok: true, provider: await saveProviderConfig(message.config) };
    case 'providers:delete':
      await deleteProviderConfig(message.id);
      return { ok: true };
    case 'providers:list-models': {
      const provider = (await listProviderConfigs()).find((item) => item.id === message.id);
      if (!provider) throw new Error('供应商配置不存在');
      const providerModels = await listProviderModels(provider);
      await saveProviderConfig({ ...provider, modelList: providerModels });
      return { ok: true, providerModels };
    }
    case 'models:list':
      return { ok: true, models: await listModelConfigs() };
    case 'models:save':
      return { ok: true, model: await saveModelConfig(message.config) };
    case 'models:delete':
      await deleteModelConfig(message.id);
      return { ok: true };
    case 'webdav:get-config':
      return { ok: true, webDavConfig: await getWebDavConfig() };
    case 'webdav:save-config':
      return { ok: true, webDavConfig: await saveWebDavConfig(message.config) };
    case 'webdav:test':
      return { ok: true, message: await testWebDavConnection(await getWebDavConfig()) };
    case 'webdav:backup-models': {
      const config = await getWebDavConfig();
      const models = await listModelConfigs();
      const agentsResult = await chrome.storage.local.get(AGENT_STORAGE_KEY);
      const agents = ((agentsResult as Record<string, AgentConfig[]>)[AGENT_STORAGE_KEY] || []).filter((item) => item.name && item.prompt);
      const settings = await getAppSettings();
      const message = await uploadBackup(config, { version: 1, app: 'gy-ai-crx', exportedAt: Date.now(), models, agents, settings });
      return { ok: true, message };
    }
    case 'webdav:restore-models': {
      const payload = await downloadBackup(await getWebDavConfig());
      await replaceModelConfigs(payload.models);
      await chrome.storage.local.set({ [AGENT_STORAGE_KEY]: payload.agents || [] });
      if (payload.settings) await restoreAppSettings(payload.settings);
      return { ok: true, message: `已恢复 ${payload.models.length} 个模型配置、${(payload.agents || []).length} 个 Agent${payload.settings ? '、设置' : ''}` };
    }
    case 'settings:get':
      return { ok: true, settings: await getAppSettings() };
    case 'settings:save':
      return { ok: true, settings: await saveAppSettings(message.settings) };
    case 'chat:send': {
      const config = await requireModel(message.request.modelConfigId);
      return { ok: true, response: await sendChat(message.request, config) };
    }
    case 'chat:stream': {
      const config = await requireModel(message.request.modelConfigId);
      try {
        const response = await streamChat(message.request, config, (chunk) => chrome.runtime.sendMessage({ type: 'chat:stream-chunk', streamId: message.streamId, chunk }).catch(() => undefined));
        await chrome.runtime.sendMessage({ type: 'chat:stream-done', streamId: message.streamId, message: response.message }).catch(() => undefined);
        return { ok: true, response };
      } catch (error) {
        await chrome.runtime.sendMessage({ type: 'chat:stream-error', streamId: message.streamId, error: error instanceof Error ? error.message : String(error) }).catch(() => undefined);
        throw error;
      }
    }
    case 'image:generate': {
      const config = await requireModel(message.request.modelConfigId);
      return { ok: true, asset: await generateImage(message.request, config) };
    }
    case 'page:read': {
      const tabId = await getActiveTabId(sender);
      await ensureCommonContentScript(tabId);
      const response = await chrome.tabs.sendMessage(tabId, { type: 'content:read-page' });
      return response as RuntimeResponse;
    }
    case 'site:detect': {
      const tabId = await getActiveTabId(sender);
      await ensureCommonContentScript(tabId);
      const response = await chrome.tabs.sendMessage(tabId, { type: 'content:detect-site' }).catch(() => undefined);
      if (response?.ok) return response as RuntimeResponse;
      const page = await chrome.tabs.sendMessage(tabId, { type: 'content:read-page' });
      return {
        ok: true,
        siteContext: {
          adapterId: 'common',
          name: '通用网页',
          url: (page as any)?.pageContext?.url || '',
          capabilities: [
            { type: 'read-page', label: '读取页面', description: '读取当前页面正文用于聊天。', risk: 'safe' }
          ]
        }
      };
    }
    case 'site:action': {
      const tabId = await getActiveTabId(sender);
      await ensureCommonContentScript(tabId);
      const response = await chrome.tabs.sendMessage(tabId, { type: 'content:site-action', action: message.action });
      return response as RuntimeResponse;
    }
    default:
      throw new Error('未知消息类型');
  }
}

async function requireModel(id: string) {
  const config = await getModelConfig(id);
  if (!config) throw new Error('模型配置不存在或已禁用');
  return config;
}

async function ensureCommonContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content/common.js'] }).catch(() => undefined);
}

async function getActiveTabId(sender: chrome.runtime.MessageSender): Promise<number> {
  if (sender.tab?.id) return sender.tab.id;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('未找到当前标签页');
  return tab.id;
}
