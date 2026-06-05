import { useEffect, useMemo, useState } from 'react';
import Button from 'antd/es/button';
import Tabs from 'antd/es/tabs';
import SettingOutlined from '@ant-design/icons/SettingOutlined';
import type { AgentConfig } from '../shared/agentConfig';
import { AGENT_STORAGE_KEY, createDefaultAgentConfigs } from '../shared/agentConfig';
import type { ImageAsset } from '../shared/assets';
import type { ChatMessage } from '../shared/messages';
import type { ModelConfig } from '../shared/modelConfig';
import { MODEL_CAPABILITY_LABELS } from '../shared/modelConfig';
import { findDefaultModel, getModelProviderGroupName } from '../shared/modelConfigUtils';
import type { PageContext, SiteContext } from '../shared/siteCapability';
import { sendRuntimeMessage } from '../shared/runtime';
import { ChatPanel } from './ChatPanel';
import { TextPanel } from './TextPanel';
import { ImagePanel } from './ImagePanel';
import {
  deleteChatSession,
  deleteImageGeneration,
  deleteTextGeneration,
  listChatSessions,
  listImageGenerations,
  listTextGenerations,
  saveChatSession,
  saveImageGenerationFromAsset,
  saveTextGeneration,
  type ChatSessionHistory,
  type ImageGenerationHistory,
  type TextGenerationHistory
} from './historyStore';

const MODEL_STORAGE_KEY = 'gy-ai:model-configs';
const PROVIDER_STORAGE_KEY = 'gy-ai:provider-configs';
const AGENT_GREETING_PROMPT = '你以该角色开始新会话时，首次回复必须先主动向用户打招呼，简短说明你能提供的帮助，然后再回答用户的问题。';
const LATEST_RELEASE_API_URL = 'https://api.github.com/repos/ahao430/simple-ai-assistant-crx/releases/latest';
const RELEASES_PAGE_URL = 'https://github.com/ahao430/simple-ai-assistant-crx/releases';

interface ChatSessionAgentSnapshot {
  agentConfigId?: string;
  agentName: string;
  agentPrompt: string;
}

interface LatestRelease {
  tag_name: string;
  html_url?: string;
}

export function App() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [textModelId, setTextModelId] = useState('');
  const [imageModelId, setImageModelId] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSessionHistory[]>([]);
  const [currentChatSessionId, setCurrentChatSessionId] = useState('');
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [currentSessionAgent, setCurrentSessionAgent] = useState<ChatSessionAgentSnapshot>();
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatImages, setChatImages] = useState<string[]>([]);
  const [textInput, setTextInput] = useState('');
  const [textResult, setTextResult] = useState('');
  const [textHistory, setTextHistory] = useState<TextGenerationHistory[]>([]);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [pageContext, setPageContext] = useState<PageContext>();
  const [siteContext, setSiteContext] = useState<SiteContext>();
  const [status, setStatus] = useState('');
  const [toast, setToast] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [imageAsset, setImageAsset] = useState<ImageAsset>();
  const [imageHistory, setImageHistory] = useState<ImageGenerationHistory[]>([]);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [latestRelease, setLatestRelease] = useState<LatestRelease>();

  const textModels = useMemo(() => models.filter((model) => model.enabled && model.providerEnabled !== false && (model.capabilities.includes('text') || model.capabilities.includes('vision'))), [models]);
  const imageModels = useMemo(() => models.filter((model) => model.enabled && model.providerEnabled !== false && (model.capabilities.includes('image-generation') || model.capabilities.includes('image-edit'))), [models]);
  const textModelOptions = useMemo(() => createGroupedModelOptions(textModels), [textModels]);
  const imageModelOptions = useMemo(() => createGroupedModelOptions(imageModels, true), [imageModels]);

  useEffect(() => {
    initialize();
    checkForUpdates();

    const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== 'local') return;
      if (changes[MODEL_STORAGE_KEY] || changes[PROVIDER_STORAGE_KEY]) refreshModels();
      if (changes[AGENT_STORAGE_KEY]) loadAgents();
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  async function initialize() {
    try {
      const modelsResult = await sendRuntimeMessage<{ ok: true; models: ModelConfig[] }>({ type: 'models:list' });
      applyModels(modelsResult.models);
      const nextAgents = await loadAgents();
      await loadChatSessions(nextAgents);
      await loadGenerationHistories();
      await detectSite();
      await readPage();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function refreshModels() {
    try {
      const response = await sendRuntimeMessage<{ ok: true; models: ModelConfig[] }>({ type: 'models:list' });
      applyModels(response.models);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function loadAgents() {
    const result = await chrome.storage.local.get(AGENT_STORAGE_KEY);
    const savedAgents = (result as Record<string, AgentConfig[]>)[AGENT_STORAGE_KEY];
    const savedValidAgents = savedAgents?.filter((item) => item.name && item.prompt) ?? [];
    const nextAgents = savedValidAgents.length ? savedValidAgents : createDefaultAgentConfigs();
    if (!savedValidAgents.length) await chrome.storage.local.set({ [AGENT_STORAGE_KEY]: nextAgents });
    setAgents(nextAgents);
    return nextAgents;
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast((current) => current === message ? '' : current), 1800);
  }

  async function checkForUpdates() {
    try {
      const response = await fetch(LATEST_RELEASE_API_URL);
      if (!response.ok) return;
      const release = await response.json() as LatestRelease;
      const currentVersion = chrome.runtime.getManifest().version;
      if (isNewerVersion(release.tag_name, currentVersion)) setLatestRelease(release);
    } catch {
      // Ignore update check failures so opening the panel never gets blocked.
    }
  }

  function openReleasesPage() {
    chrome.tabs.create({ url: latestRelease?.html_url || RELEASES_PAGE_URL });
  }

  function applyModels(nextModels: ModelConfig[]) {
    setModels(nextModels);
    setTextModelId((current) => current && nextModels.some((model) => model.id === current && model.enabled && model.providerEnabled !== false && (model.capabilities.includes('text') || model.capabilities.includes('vision')))
      ? current
      : findDefaultModel(nextModels, 'text')?.id || findDefaultModel(nextModels, 'vision')?.id || '');
    setImageModelId((current) => current && nextModels.some((model) => model.id === current && model.enabled && model.providerEnabled !== false && (model.capabilities.includes('image-generation') || model.capabilities.includes('image-edit')))
      ? current
      : findDefaultModel(nextModels, 'image-generation')?.id || findDefaultModel(nextModels, 'image-edit')?.id || '');
  }

  async function loadChatSessions(agentItems = agents) {
    let sessions = await normalizeChatSessions(await listChatSessions(), agentItems);
    if (!sessions.length) {
      const result = await chrome.storage.local.get('chatHistory');
      const saved = (result as { chatHistory?: ChatMessage[] }).chatHistory;
      if (saved?.length) {
        const now = Date.now();
        const session: ChatSessionHistory = {
          id: crypto.randomUUID(),
          title: createChatSessionTitle(saved),
          messages: saved,
          modelConfigId: textModelId,
          createdAt: now,
          updatedAt: now
        };
        await saveChatSession(session);
        await chrome.storage.local.remove('chatHistory');
        sessions = [session];
      }
    }

    setChatSessions(sessions);
    const current = sessions[0];
    setCurrentChatSessionId(current?.id || '');
    setCurrentSessionAgent(createSessionAgentSnapshot(current));
    setChatMessages(current?.messages || []);
  }

  async function refreshChatSessions(selectedId = currentChatSessionId) {
    const sessions = await normalizeChatSessions(await listChatSessions(), agents);
    setChatSessions(sessions);
    const selected = sessions.find((session) => session.id === selectedId) || sessions[0];
    setCurrentChatSessionId(selected?.id || '');
    setCurrentSessionAgent(createSessionAgentSnapshot(selected));
    setChatMessages(selected?.messages || []);
  }

  async function newChatSession(agent?: AgentConfig) {
    const agentSnapshot = agent ? createAgentSnapshot(agent) : undefined;
    setCurrentChatSessionId('');
    setCurrentSessionAgent(agentSnapshot);
    setChatMessages([]);
    setChatInput('');
    setChatImages([]);

    if (agentSnapshot && textModelId && !isChatStreaming) {
      const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: '你好', hidden: true, createdAt: Date.now() };
      await streamMessages('chat', [userMessage], setChatMessages, 'AI 正在打招呼...', '', pageContext, siteContext, true, agentSnapshot, '');
    }
  }

  async function selectChatSession(id: string) {
    const session = chatSessions.find((item) => item.id === id);
    if (!session) return;
    setCurrentChatSessionId(session.id);
    setCurrentSessionAgent(createSessionAgentSnapshot(session));
    setChatMessages(session.messages);
  }

  async function removeChatSession(id: string) {
    await deleteChatSession(id);
    await refreshChatSessions(id === currentChatSessionId ? '' : currentChatSessionId);
  }

  async function normalizeChatSessions(sessions: ChatSessionHistory[], agentItems: AgentConfig[]) {
    const normalized = await Promise.all(sessions.map(async (session) => {
      if ((!session.agentName || !session.agentPrompt) && session.agentConfigId) {
        const agent = agentItems.find((item) => item.id === session.agentConfigId);
        if (agent) {
          const updated = { ...session, ...createAgentSnapshot(agent) };
          await saveChatSession(updated);
          return updated;
        }
      }
      return session;
    }));
    return normalized;
  }

  function createAgentSnapshot(agent: AgentConfig): ChatSessionAgentSnapshot {
    return { agentConfigId: agent.id, agentName: agent.name, agentPrompt: agent.prompt };
  }

  function createSessionAgentSnapshot(session?: ChatSessionHistory): ChatSessionAgentSnapshot | undefined {
    if (!session?.agentName || !session.agentPrompt) return undefined;
    return { agentConfigId: session.agentConfigId, agentName: session.agentName, agentPrompt: session.agentPrompt };
  }

  async function persistChatSession(messages: ChatMessage[], agentSnapshot = currentSessionAgent, chatSessionId = currentChatSessionId) {
    const now = Date.now();
    const existing = chatSessions.find((session) => session.id === chatSessionId);
    const session: ChatSessionHistory = {
      id: existing?.id || crypto.randomUUID(),
      title: existing?.title || createChatSessionTitle(messages),
      messages,
      modelConfigId: textModelId,
      agentConfigId: agentSnapshot?.agentConfigId,
      agentName: agentSnapshot?.agentName,
      agentPrompt: agentSnapshot?.agentPrompt,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    await saveChatSession(session);
    setCurrentChatSessionId(session.id);
    await refreshChatSessions(session.id);
  }

  async function loadGenerationHistories() {
    const [texts, images] = await Promise.all([listTextGenerations(), listImageGenerations()]);
    setTextHistory(texts);
    setImageHistory(images);
  }

  async function removeTextHistory(id: string) {
    await deleteTextGeneration(id);
    setTextHistory(await listTextGenerations());
  }

  async function removeImageHistory(id: string) {
    await deleteImageGeneration(id);
    setImageHistory(await listImageGenerations());
  }

  async function detectSite() {
    const response = await sendRuntimeMessage<{ ok: true; siteContext: SiteContext }>({ type: 'site:detect' });
    setSiteContext(response.siteContext);
  }

  async function readPage() {
    try {
      setStatus('正在读取页面内容...');
      const response = await sendRuntimeMessage<{ ok: true; pageContext: PageContext }>({ type: 'page:read' });
      setPageContext(response.pageContext);
      setStatus(`已读取：${response.pageContext.title}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function sendChat() {
    if (!chatInput.trim() || !textModelId) return;

    const images = chatImages.length ? [...chatImages] : undefined;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: chatInput.trim(), images, createdAt: Date.now() };
    const nextMessages = [...chatMessages, userMessage];
    setChatInput('');
    setChatImages([]);
    await streamMessages('chat', nextMessages, setChatMessages, 'AI 正在回复...', '');
  }

  async function readArticleAndAnalyze() {
    if (!textModelId || isChatStreaming) return;

    try {
      setStatus('正在读取本文信息...');
      const detected = await sendRuntimeMessage<{ ok: true; siteContext: SiteContext }>({ type: 'site:detect' });
      const context = await readArticleContext(detected.siteContext);
      setPageContext(context.pageContext);
      setSiteContext(context.siteContext);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: createArticleAnalysisPrompt(context.pageContext),
        displayContent: '阅读本文信息',
        createdAt: Date.now()
      };
      await streamMessages('chat', [...chatMessages, userMessage], setChatMessages, 'AI 正在分析本文...', '', context.pageContext, context.siteContext, false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message);
      showToast(message);
    }
  }

  async function readArticleContext(currentSiteContext: SiteContext) {
    if (isYuqueUrl(currentSiteContext.url)) {
      try {
        return await readYuqueMarkdownContext(currentSiteContext);
      } catch {
        setStatus('未读取到语雀 Markdown，改为读取页面正文...');
      }
    }

    return readGenericPageContext(currentSiteContext);
  }

  async function readGenericPageContext(currentSiteContext: SiteContext) {
    const response = await sendRuntimeMessage<{ ok: true; pageContext: PageContext }>({ type: 'page:read' });
    return { pageContext: response.pageContext, siteContext: currentSiteContext };
  }

  async function readYuqueMarkdownContext(currentSiteContext: SiteContext) {
    await sendRuntimeMessage<{ ok: true; result: { message: string } }>({ type: 'site:action', action: { type: 'copy-yuque-markdown' } });
    await delay(600);
    const text = (await navigator.clipboard.readText()).trim();
    if (!text) throw new Error('未读取到语雀 Markdown 内容，请确认浏览器允许读取剪贴板');

    const pageContext: PageContext = {
      title: currentSiteContext.name,
      url: currentSiteContext.url,
      text: text.slice(0, 20000),
      capturedAt: Date.now()
    };
    return { pageContext, siteContext: currentSiteContext };
  }

  async function generateText() {
    if (!textInput.trim() || !textModelId || isGeneratingText) return;

    const prompt = textInput.trim();
    setIsGeneratingText(true);
    setTextResult('');
    setStatus('AI 正在生成文案...');

    try {
      await streamTextGeneration(prompt);
    } finally {
      setIsGeneratingText(false);
    }
  }

  async function regenerateText() {
    if (!textInput.trim() || !textModelId || isGeneratingText) return;
    await generateText();
  }

  async function streamTextGeneration(prompt: string) {
    const streamId = crypto.randomUUID();

    const listener = (message: { type?: string; streamId?: string; chunk?: string; message?: ChatMessage }) => {
      if (message.streamId !== streamId) return;

      if (message.type === 'chat:stream-chunk') {
        setTextResult((prev) => prev + (message.chunk || ''));
      }

      if (message.type === 'chat:stream-done' && message.message) {
        setTextResult(message.message.content);
        setStatus('文案已生成');
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    try {
      const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: prompt, createdAt: Date.now() };
      const response = await sendRuntimeMessage<{ ok: true; response: { message: ChatMessage } }>({
        type: 'chat:stream',
        streamId,
        request: {
          conversationId: 'text-generation',
          modelConfigId: textModelId,
          messages: withContext([userMessage]),
          pageContext,
          siteContext
        }
      });
      const result = response.response.message.content;
      setTextResult(result);
      await saveTextGeneration({
        id: crypto.randomUUID(),
        prompt,
        result,
        modelConfigId: textModelId,
        pageTitle: pageContext?.title,
        pageUrl: pageContext?.url,
        createdAt: Date.now()
      });
      setTextHistory(await listTextGenerations());
      setStatus('文案已生成');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      chrome.runtime.onMessage.removeListener(listener);
    }
  }

  async function regenerateChat(messageId: string) {
    await regenerateFromMessage('chat', chatMessages, setChatMessages, messageId, 'AI 正在回复...', '');
  }

  async function regenerateFromMessage(
    conversationId: string,
    messages: ChatMessage[],
    setMessages: (messages: ChatMessage[] | ((messages: ChatMessage[]) => ChatMessage[])) => void,
    messageId: string,
    pendingStatus: string,
    doneStatus: string
  ) {
    if (!textModelId) return;

    const index = messages.findIndex((message) => message.id === messageId);
    if (index <= 0) return;

    const nextMessages = messages.slice(0, index);
    await streamMessages(conversationId, nextMessages, setMessages, pendingStatus, doneStatus);
  }

  async function streamMessages(
    conversationId: string,
    nextMessages: ChatMessage[],
    setMessages: (messages: ChatMessage[] | ((messages: ChatMessage[]) => ChatMessage[])) => void,
    pendingStatus: string,
    doneStatus: string,
    contextPageContext = pageContext,
    contextSiteContext = siteContext,
    includeContext = true,
    agentSnapshot = currentSessionAgent,
    chatSessionId = currentChatSessionId
  ) {
    const streamId = crypto.randomUUID();
    const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', createdAt: Date.now() };

    setMessages([...nextMessages, assistantMessage]);
    setStatus(pendingStatus);
    if (conversationId === 'chat') setIsChatStreaming(true);

    const listener = (message: { type?: string; streamId?: string; chunk?: string; message?: ChatMessage }) => {
      if (message.streamId !== streamId) return;

      if (message.type === 'chat:stream-chunk') {
        setMessages((messages) => messages.map((item) => item.id === assistantMessage.id ? { ...item, content: item.content + (message.chunk || '') } : item));
      }

      if (message.type === 'chat:stream-done' && message.message) {
        setMessages((messages) => messages.map((item) => item.id === assistantMessage.id ? { ...message.message!, id: assistantMessage.id } : item));
        setStatus(doneStatus);
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    try {
      const response = await sendRuntimeMessage<{ ok: true; response: { message: ChatMessage } }>({
        type: 'chat:stream',
        streamId,
        request: {
          conversationId,
          modelConfigId: textModelId,
          messages: includeContext ? withContext(nextMessages, contextPageContext, contextSiteContext, agentSnapshot) : [...createAgentSystemMessages(agentSnapshot), ...nextMessages],
          pageContext: contextPageContext,
          siteContext: contextSiteContext
        }
      });
      const finalMessages = [...nextMessages, { ...response.response.message, id: assistantMessage.id }];
      setMessages(finalMessages);
      if (conversationId === 'chat') await persistChatSession(finalMessages, agentSnapshot, chatSessionId);
      setStatus(doneStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMessages((messages) => messages.filter((item) => item.id !== assistantMessage.id || item.content));
      setStatus(message);
      showToast(message);
    } finally {
      if (conversationId === 'chat') setIsChatStreaming(false);
      chrome.runtime.onMessage.removeListener(listener);
    }
  }

  function createAgentSystemMessages(agentSnapshot = currentSessionAgent): ChatMessage[] {
    if (!agentSnapshot) return [];

    return [{
      id: `agent:${agentSnapshot.agentConfigId || agentSnapshot.agentName}`,
      role: 'system',
      content: `你现在是「${agentSnapshot.agentName}」。\n\n${AGENT_GREETING_PROMPT}\n\n${agentSnapshot.agentPrompt}`,
      createdAt: Date.now()
    }];
  }

  function withContext(nextMessages: ChatMessage[], contextPageContext = pageContext, contextSiteContext = siteContext, agentSnapshot = currentSessionAgent): ChatMessage[] {
    const systemMessages = createAgentSystemMessages(agentSnapshot);
    const context = [
      contextPageContext ? `当前页面：${contextPageContext.title}\n${contextPageContext.url}\n选中文本：${contextPageContext.selectedText || '无'}\n页面内容：${contextPageContext.text}` : '',
      contextSiteContext ? `当前站点能力：${contextSiteContext.name}\n${contextSiteContext.capabilities.map((item) => `${item.label}: ${item.description}`).join('\n')}` : ''
    ].filter(Boolean).join('\n\n');

    if (context) {
      systemMessages.push({ id: 'context', role: 'system', content: `请结合以下页面上下文回答用户问题。涉及写入页面时，只给出建议，不要声称已经执行。\n\n${context}`, createdAt: Date.now() });
    }

    return [...systemMessages, ...nextMessages];
  }

  async function generateImage() {
    if (!imagePrompt.trim() || !imageModelId || isGeneratingImage) return;

    try {
      setIsGeneratingImage(true);
      setImageAsset(undefined);
      setStatus('正在生成图片...');
      const mode = referenceImages.length ? 'reference' : 'generate';
      const response = await sendRuntimeMessage<{ ok: true; asset: ImageAsset }>({
        type: 'image:generate',
        request: {
          modelConfigId: imageModelId,
          mode,
          prompt: imagePrompt,
          referenceImages: referenceImages.length ? referenceImages : undefined
        }
      });
      setImageAsset(response.asset);
      await saveImageGenerationFromAsset({
        id: crypto.randomUUID(),
        mode,
        prompt: imagePrompt,
        modelConfigId: imageModelId,
        createdAt: Date.now()
      }, response.asset);
      setImageHistory(await listImageGenerations());
      setStatus('图片已生成');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsGeneratingImage(false);
    }
  }

  async function copyText(text?: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setStatus('已复制文字');
    showToast('已复制文字');
  }

  async function copyImage(asset = imageAsset) {
    if (!asset?.dataUrl) return;
    await writeImageToClipboard(asset);
    setStatus('已复制图片，可直接粘贴');
    showToast('已复制图片');
  }

  async function onImageFiles(files: File[]) {
    const images = await Promise.all(files.map(readFileAsDataUrl));
    setReferenceImages(images);
  }

  async function onChatImageFiles(files: File[]) {
    const images = await Promise.all(files.map(readFileAsDataUrl));
    setChatImages(images);
  }

  return (
    <main className="app">
      {toast && <div className="toast">{toast}</div>}
      <Button className="app-settings" size="small" icon={<SettingOutlined />} onClick={() => chrome.runtime.openOptionsPage()} />
      {latestRelease && <div className="update-banner">
        <span>发现新版本 {latestRelease.tag_name}</span>
        <Button size="small" type="primary" onClick={openReleasesPage}>去更新</Button>
      </div>}
      <Tabs className="work-tabs" defaultActiveKey="chat" items={[
        {
          key: 'chat',
          label: '聊天',
          children: <ChatPanel
            messages={chatMessages}
            chatSessions={chatSessions}
            currentChatSessionId={currentChatSessionId}
            agents={agents}
            currentAgentName={currentSessionAgent?.agentName}
            input={chatInput}
            setInput={setChatInput}
            chatImages={chatImages}
            onChatImageFiles={onChatImageFiles}
            textModelOptions={textModelOptions}
            textModelId={textModelId}
            setTextModelId={setTextModelId}
            isStreaming={isChatStreaming}
            status={status}
            onSend={sendChat}
            onReadArticle={readArticleAndAnalyze}
            onCopyText={copyText}
            onRegenerate={regenerateChat}
            onNewChatSession={newChatSession}
            onSelectChatSession={selectChatSession}
            onDeleteChatSession={removeChatSession}
          />
        },
        {
          key: 'text',
          label: '文案生成',
          children: <TextPanel
            input={textInput}
            setInput={setTextInput}
            textResult={textResult}
            textHistory={textHistory}
            isGenerating={isGeneratingText}
            textModelOptions={textModelOptions}
            textModelId={textModelId}
            setTextModelId={setTextModelId}
            onSend={generateText}
            onCopyText={copyText}
            onRegenerate={regenerateText}
            onDeleteHistory={removeTextHistory}
          />
        },
        {
          key: 'image',
          label: '图片生成',
          children: <ImagePanel
            imageModelOptions={imageModelOptions}
            imageModelId={imageModelId}
            setImageModelId={setImageModelId}
            imagePrompt={imagePrompt}
            setImagePrompt={setImagePrompt}
            referenceImages={referenceImages}
            onImageFiles={onImageFiles}
            imageAsset={imageAsset}
            imageHistory={imageHistory}
            isGenerating={isGeneratingImage}
            onGenerate={generateImage}
            onCopyImage={copyImage}
            onDeleteHistory={removeImageHistory}
          />
        }
      ]} />
    </main>
  );
}

function createArticleAnalysisPrompt(pageContext: PageContext): string {
  return `请阅读下面的页面内容，输出简洁总结。要求：\n1. 用 3-5 个要点概括核心信息。\n2. 如有明确结论或待办，单独列出。\n3. 不要长篇分析，不要复述无关细节。\n\n标题：${pageContext.title}\n链接：${pageContext.url}\n\n页面内容：\n${pageContext.text}`;
}

function isYuqueUrl(url: string): boolean {
  return /^https:\/\/www\.yuque\.com\//.test(url);
}

function isNewerVersion(tagName: string, currentVersion: string): boolean {
  const latest = tagName.replace(/^v/i, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const current = currentVersion.replace(/^v/i, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(latest.length, current.length); index += 1) {
    const latestPart = latest[index] || 0;
    const currentPart = current[index] || 0;
    if (latestPart !== currentPart) return latestPart > currentPart;
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createGroupedModelOptions(models: ModelConfig[], showCapabilities = false) {
  const groups = new Map<string, ModelConfig[]>();
  for (const model of models) {
    const groupName = getModelProviderGroupName(model);
    groups.set(groupName, [...(groups.get(groupName) || []), model]);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    options: items.map((model) => ({
      value: model.id,
      label: showCapabilities ? `${model.name} · ${model.capabilities.map((capability) => MODEL_CAPABILITY_LABELS[capability]).join('/')}` : model.name
    }))
  }));
}

async function writeImageToClipboard(asset: ImageAsset): Promise<void> {
  const blob = await (await fetch(asset.dataUrl)).blob();
  await navigator.clipboard.write([new ClipboardItem({ [blob.type || asset.mimeType]: blob })]);
}

function createChatSessionTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user' && message.content.trim());
  return firstUserMessage ? firstUserMessage.content.trim().slice(0, 30) : '新会话';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
